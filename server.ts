import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import axios from 'axios';
import { analyzeImageDataUri, analyzeAudioDataUri, analyzeVideoDataUri } from './src/lib/nvidiaApi';

dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.NVIDIA_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.API_KEY;
const openai = new OpenAI({
  apiKey: NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_OPENAI_BASE_URL || "https://integrate.api.nvidia.com/v1",
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON requests (for images and video)
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ extended: true, limit: "200mb" }));
  
  // Custom error handler for JSON parsing issues
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: "Payload too large. Video size exceeds 200MB limit." });
    }
    next();
  });

  // Initialize Gemini
  let ai: GoogleGenAI | null = null;
  const initGemini = () => {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
         console.warn("GEMINI_API_KEY is not set.");
      } else {
         ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      }
    }
    return ai;
  };

  // NVIDIA API key check
  if (!NVIDIA_API_KEY) {
    console.warn('NVIDIA_API_KEY is not set. Set NVIDIA_API_KEY, NVIDIA_OPENAI_API_KEY, OPENAI_API_KEY, or API_KEY in your environment to call the NVIDIA Integrate API.');
  }

  // Helper to format Gemini API errors
  const formatGeminiError = (error: any, defaultMessage: string) => {
    if (error?.message) {
      if (error.message.includes("503") || error.message.includes("UNAVAILABLE") || error.message.includes("high demand")) {
        return "The AI model is currently experiencing high demand. Please try again in a few moments.";
      }
      try {
        // Try to parse the inner error JSON if it exists
        const match = error.message.match(/(\{.*\})/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed?.error?.message) {
            return parsed.error.message;
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      return error.message;
    }
    return defaultMessage;
  };

  const parseTextAnalysisResponse = (text: string) => {
    if (!text) return null;
    const cleaned = text.trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}$/);
    const candidate = jsonMatch ? jsonMatch[0] : cleaned;
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // try a looser regex extraction of the first object-like block
      const looserMatch = cleaned.match(/\{[\s\S]*\}/);
      if (looserMatch) {
        try {
          return JSON.parse(looserMatch[0]);
        } catch (err) {
          // fall through to text parsing below
        }
      }
    }

    const classificationMatch = cleaned.match(/classification\s*[:\-]?\s*([A-Za-z]+)/i);
    const factCheckMatch = cleaned.match(/fact\s*check\s*[:\-]?\s*([\s\S]*?)(?=\n\s*grammar\s*check\s*[:\-]?|$)/i);
    const grammarMatch = cleaned.match(/grammar\s*check\s*[:\-]?\s*([\s\S]*)/i);

    return {
      classification: classificationMatch?.[1]?.trim().toUpperCase() ?? 'UNKNOWN',
      factCheck: factCheckMatch?.[1]?.trim() ?? cleaned,
      grammarCheck: grammarMatch?.[1]?.trim() ?? 'Failed to parse grammar.',
    };
  };

  const normalizeTextAnalysisResult = (result: any) => {
    if (!result || typeof result !== 'object') {
      return {
        classification: 'UNKNOWN',
        factCheck: 'Failed to parse analysis.',
        grammarCheck: 'Failed to parse grammar.',
      };
    }

    const grammarCheck = Array.isArray(result.grammarCheck)
      ? result.grammarCheck.join('\n')
      : typeof result.grammarCheck === 'string'
      ? result.grammarCheck
      : String(result.grammarCheck ?? 'Failed to parse grammar.');

    return {
      classification: typeof result.classification === 'string' ? result.classification : 'UNKNOWN',
      factCheck: typeof result.factCheck === 'string' ? result.factCheck : String(result.factCheck ?? 'Failed to parse analysis.'),
      grammarCheck,
    };
  };

  // API Routes
  app.post("/api/describe-image", async (req, res) => {
    try {
      const gemini = initGemini();
      if (!gemini) {
         return res.status(500).json({ error: "Gemini API is not configured on the server." });
      }

      const { image } = req.body; // Expecting a base64 string "data:image/jpeg;base64,..."
      
      if (!image) {
         return res.status(400).json({ error: "No image provided." });
      }

      // Parse the base64 string safely
      const commaIndex = image.indexOf(',');
      if (commaIndex === -1 || !image.startsWith('data:image/')) {
         return res.status(400).json({ error: "Invalid image format. Expected a base64 data URI." });
      }
      
      const mimeType = image.substring(5, image.indexOf(';'));
      const base64Data = image.substring(commaIndex + 1);

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              {
                text: `Analyze the provided image and return a valid JSON object with three fields: "description" (string), "analysis" (string), and "isFake" (boolean).

"description": Start with the heading "Image Description" and provide a detailed summary of the image. Include the subject, setting, lighting, mood, and style. Then add these sections:
- "Detected Objects:" with bullet points for the main objects, items, and entities.
- "Key details:" with bullet points for important visual features and composition.
- "The photo style feels:" with bullet points describing the mood, aesthetic, and photographic style.

Example format:
Image Description

The image is a black-and-white close-up portrait of a child wearing a sideways cap and a fake mustache. The image has a shallow depth-of-field effect, making the eyes very sharp while the background stays soft and blurred.
Detected Objects:
• Child
• Cap
• Fake mustache
• Clothing
Key details:
• Monochrome / grayscale photography style
• Strong focus on facial expression and eyes
The photo style feels:
• Vintage
• Cinematic

"analysis": Start with the heading "Deepfake / Manipulation Analysis". Provide a detailed authenticity and manipulation assessment. Include sections with numbered headings and observations such as "Face Consistency", "Mustache Analysis", and "AI/Deepfake Artifact Inspection". End with a clear conclusion and whether the image appears authentic, manipulated, or AI-generated.

"isFake": Return true if the image is highly likely AI-generated or manipulated, otherwise return false.`
              }
            ]
          }
        ],
        config: {
            responseMimeType: "application/json",
        }
      });

      const responseText = response.text;
      let analysisResult = { description: "Failed to parse description.", analysis: "Analysis failed.", isFake: false };
      if (responseText) {
          try {
              analysisResult = JSON.parse(responseText);
          } catch (e) {
              console.error("Failed to parse JSON", e);
          }
      }

      res.json(analysisResult);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: formatGeminiError(error, "Failed to process image with AI.") });
    }
  });

  const handleVideoAnalysisRequest = async (req: express.Request, res: express.Response) => {
    try {
      if (!NVIDIA_API_KEY) {
        return res.status(500).json({ error: 'NVIDIA API key is not configured.' });
      }

      const { video, prompt } = req.body;
      if (!video || typeof video !== 'string') {
         return res.status(400).json({ error: 'No video provided.' });
      }
      if (!video.startsWith('data:video/')) {
         return res.status(400).json({ error: 'Invalid video format. Expected a base64 video data URI.' });
      }

      const nvUrl = `${process.env.NVIDIA_OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
      const payload = {
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'Analyze the provided video for forensic authenticity and deepfake indicators. Return a valid JSON object with fields: description (string), analysis (string), and isFake (boolean).'
              },
              {
                type: 'video_url',
                video_url: { url: video }
              }
            ]
          }
        ],
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 65536,
        reasoning_budget: 16384,
        chat_template_kwargs: { enable_thinking: true },
        stream: false
      };

      const headers = {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      };

      const nvResponse = await axios.post(nvUrl, payload, { headers });
      const text = extractModelText(nvResponse.data);
      let analysisResult = { description: 'Failed to parse description.', analysis: 'Analysis failed.', isFake: false };

      if (typeof text === 'string') {
        try {
          const jsonMatch = text.trim().match(/\{[\s\S]*\}$/);
          if (jsonMatch) {
            analysisResult = JSON.parse(jsonMatch[0]);
          } else {
            analysisResult = { description: text, analysis: text, isFake: false };
          }
        } catch (e) {
          console.error('Failed to parse NVIDIA video JSON', e);
          analysisResult = { description: text, analysis: text, isFake: false };
        }
      }

      res.json(analysisResult);
    } catch (error: any) {
      console.error('NVIDIA Video API Error:', error);
      if (error?.response) {
        return res.status(error.response.status || 500).json({ error: error.response.data || error.message });
      }
      res.status(500).json({ error: error?.message || 'Failed to process video with NVIDIA API.' });
    }
  };

  app.post('/api/nvidia/analyze-video', handleVideoAnalysisRequest);
  app.post('/api/describe-video', handleVideoAnalysisRequest);

  app.post("/api/analyze-text", async (req, res) => {
    try {
      if (!process.env.NVIDIA_OPENAI_API_KEY) {
         return res.status(500).json({ error: "NVIDIA OpenAI API key is not configured on the server." });
      }

      const { text: analyzeText } = req.body;
      
      if (!analyzeText) {
         return res.status(400).json({ error: "No text provided." });
      }

      const completion = await openai.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: `Analyze the following text and respond in plain text with labeled sections only. Do not return JSON, code fences, markdown tables, or any extra metadata.

Use exactly these labels:
Classification:
FactCheck:
GrammarCheck:

Example output:
Classification: AUTHENTIC
FactCheck: Yes — it is completely real. The text simply contains the abbreviation "csk", which is a well-known shorthand for Chennai Super Kings, a professional cricket team that competes in the Indian Premier League (IPL). There is no false or misleading claim present in the text, so it is factually accurate.
GrammarCheck:
- The abbreviation "csk" is conventionally capitalized as "CSK".
- The surrounding quotation marks are unnecessary if the intent is simply to display the abbreviation.

Here is the text to analyze:

"${analyzeText}"
`,
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });

      const responseText = completion.choices?.[0]?.message?.content ?? "";
      let analysisResult = parseTextAnalysisResponse(responseText);
      if (!analysisResult) {
          console.error("Failed to parse OpenAI response:", responseText);
          analysisResult = {
             classification: "UNKNOWN",
             factCheck: responseText,
             grammarCheck: "Failed to parse grammar.",
          };
      }

      const normalized = normalizeTextAnalysisResult(analysisResult);
      res.json({
        analysis: normalized.factCheck,
        grammar: normalized.grammarCheck,
        classification: normalized.classification,
      });
    } catch (error: any) {
      console.error("OpenAI API Error:", error);
      res.status(500).json({ error: formatGeminiError(error, "Failed to analyze text with AI.") });
    }
  });

  // NVIDIA Integrate API proxy endpoints
  const extractModelText = (data: any) => {
    if (!data) return null;

    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.choices?.[0]?.delta?.content) return data.choices[0].delta.content;
    if (data.output?.[0]?.content) {
      const outputContent = data.output[0].content;
      if (Array.isArray(outputContent)) {
        return outputContent.map((item: any) => item.text || item).join('');
      }
      return outputContent.text || JSON.stringify(outputContent);
    }
    if (data.result?.output_text) return data.result.output_text;
    return JSON.stringify(data);
  };

  app.post('/api/nvidia/analyze-image', async (req, res) => {
    try {
      const { image, prompt } = req.body; // expect data URI e.g. data:image/png;base64,...
      if (!image) return res.status(400).json({ error: 'No image provided.' });
      const data = await analyzeImageDataUri(image, prompt);
      const text = extractModelText(data);
      let parsed = { description: text, analysis: text, isFake: null };
      try {
        const jsonText = typeof text === 'string' ? text.trim() : '';
        const jsonMatch = jsonText.match(/\{[\s\S]*\}$/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // leave parsed text fallback
      }
      res.json(parsed);
    } catch (err: any) {
      console.error('NVIDIA analyze-image error:', err);
      res.status(500).json({ error: err?.message || 'Failed to analyze image with NVIDIA API.' });
    }
  });

  app.post('/api/nvidia/analyze-audio', async (req, res) => {
    try {
      const { audio, prompt } = req.body; // expect data URI e.g. data:audio/wav;base64,...
      if (!audio || typeof audio !== 'string') return res.status(400).json({ error: 'No audio provided.' });
      if (!audio.startsWith('data:audio/')) return res.status(400).json({ error: 'Invalid audio format. Expected a base64 audio data URI.' });

      const data = await analyzeAudioDataUri(audio, prompt || 'Transcribe and analyze audio for authenticity.');
      const text = extractModelText(data);
      let analysisResult = { description: 'Failed to parse transcription.', analysis: text, isFake: false };

      if (typeof text === 'string') {
        try {
          const jsonMatch = text.trim().match(/\{[\s\S]*\}$/);
          if (jsonMatch) {
            analysisResult = JSON.parse(jsonMatch[0]);
          } else {
            analysisResult = { description: text, analysis: text, isFake: false };
          }
        } catch (e) {
          console.error('Failed to parse NVIDIA audio JSON', e);
          analysisResult = { description: text, analysis: text, isFake: false };
        }
      }

      res.json(analysisResult);
    } catch (err: any) {
      console.error('NVIDIA analyze-audio error:', err);
      res.status(500).json({ error: err?.message || 'Failed to analyze audio with NVIDIA API.' });
    }
  });

  // Streaming SSE proxy to NVIDIA Integrate API for image analysis
  app.post('/api/nvidia/analyze-image-stream', async (req, res) => {
    try {
      const { image, prompt } = req.body;
      if (!image) return res.status(400).json({ error: 'No image provided.' });

      const NV_API_KEY = NVIDIA_API_KEY;
      const NV_API_URL = process.env.NVIDIA_INTEGRATE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
      if (!NV_API_KEY) return res.status(500).json({ error: 'NVIDIA API key not configured.' });

      const payload = {
        model: process.env.NVIDIA_MODEL || 'mistralai/mistral-medium-3.5-128b',
        reasoning_effort: 'high',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'explain' },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        max_tokens: 16384,
        temperature: 0.7,
        top_p: 1.0,
        stream: true
      };

      const headers = {
        Authorization: `Bearer ${NV_API_KEY}`,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json'
      };

      // Call NVIDIA and stream response back to client
      const nvResp = await axios.post(NV_API_URL, payload, { headers, responseType: 'stream', timeout: 120000 });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      nvResp.data.on('data', (chunk: any) => {
        try {
          res.write(chunk);
        } catch (err) {
          // client disconnected
        }
      });

      nvResp.data.on('end', () => {
        try { res.end(); } catch (e) {}
      });

      nvResp.data.on('error', (err: any) => {
        console.error('Error from NVIDIA stream:', err?.message ?? err);
        try { res.end(); } catch (e) {}
      });

      // If client closes connection, cancel upstream request
      req.on('close', () => {
        try { nvResp.data.destroy(); } catch (e) {}
      });

    } catch (err: any) {
      console.error('NVIDIA streaming error:', err?.message ?? err);
      if (!res.headersSent) res.status(500).json({ error: err?.message || 'Streaming call failed.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    // Allow overriding the dev HMR websocket port to avoid port-in-use errors.
    const hmrPort = process.env.VITE_WS_PORT ? Number(process.env.VITE_WS_PORT) : undefined;
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: hmrPort ? { port: hmrPort } : undefined },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite dev server failed to start with custom HMR port:', (err as any)?.message ?? err);
      // Try again without specifying HMR port
      try {
        const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
        app.use(vite.middlewares);
      } catch (err2) {
        console.error('Failed to start Vite dev middleware:', err2);
      }
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Try to listen and if port is in use, attempt the next port(s)
  const tryListen = (startPort: number, attempts = 10): Promise<import('http').Server> => {
    return new Promise((resolve, reject) => {
      const server = app.listen(startPort, '0.0.0.0')
        .on('listening', () => {
          console.log(`Server running on http://localhost:${startPort}`);
          resolve(server);
        })
        .on('error', async (err: any) => {
          if (err && err.code === 'EADDRINUSE' && attempts > 0) {
            console.warn(`Port ${startPort} in use, trying ${startPort + 1}...`);
            // slight delay before retrying
            setTimeout(() => {
              tryListen(startPort + 1, attempts - 1).then(resolve).catch(reject);
            }, 200);
            return;
          }
          reject(err);
        });
    });
  };

  try {
    await tryListen(PORT, 20);
  } catch (err: any) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
