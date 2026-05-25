import axios from 'axios';

const NV_API_URL = process.env.NVIDIA_INTEGRATE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';

const getNvidiaApiKey = () => {
  return process.env.NVIDIA_API_KEY || process.env.NVIDIA_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.API_KEY || null;
};

const handleNvidiaAxiosError = (error: any) => {
  if (error?.response) {
    const status = error.response.status;
    const text = error.response.data?.error || error.response.data || JSON.stringify(error.response.data);
    if (status === 401 || status === 403) {
      throw new Error(`NVIDIA API key invalid or unauthorized. Please verify your NVIDIA_API_KEY / NVIDIA_OPENAI_API_KEY environment variable. ${text}`);
    }
    throw new Error(`NVIDIA API request failed with status ${status}: ${text}`);
  }
  throw new Error(error?.message || 'NVIDIA API request failed.');
};

export async function analyzeImageDataUri(dataUri: string, prompt = 'Describe and analyze the image for authenticity. Use fluent, professional English with correct grammar, spelling, punctuation, and complete sentences.') {
  const NV_API_KEY = getNvidiaApiKey();
  if (!NV_API_KEY) throw new Error('NVIDIA API key is not configured.');
  if (!dataUri || !dataUri.startsWith('data:')) throw new Error('Expected a data URI for the image.');

  const payload = {
    model: process.env.NVIDIA_MODEL || 'mistralai/mistral-medium-3.5-128b',
    reasoning_effort: 'high',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUri } }
        ]
      }
    ],
    max_tokens: 4096,
    temperature: 0.0,
    top_p: 1.0,
    stream: false
  };

  const headers = {
    Authorization: `Bearer ${NV_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const resp = await axios.post(NV_API_URL, payload, { headers });
    return resp.data;
  } catch (error: any) {
    handleNvidiaAxiosError(error);
  }
}

export async function analyzeVideoDataUri(dataUri: string, prompt = 'Analyze the provided video for forensic authenticity and deepfake indicators.') {
  const NV_API_KEY = getNvidiaApiKey();
  if (!NV_API_KEY) throw new Error('NVIDIA API key is not configured.');
  if (!dataUri || !dataUri.startsWith('data:video/')) throw new Error('Expected a data URI for the video.');

  const payload = {
    model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'video_url', video_url: { url: dataUri } }
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
    Authorization: `Bearer ${NV_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const resp = await axios.post(NV_API_URL, payload, { headers });
    return resp.data;
  } catch (error: any) {
    handleNvidiaAxiosError(error);
  }
}

export async function analyzeAudioDataUri(dataUri: string, prompt = 'Transcribe and analyze the audio for content and authenticity issues.') {
  const NV_API_KEY = getNvidiaApiKey();
  if (!NV_API_KEY) throw new Error('NVIDIA API key is not configured.');
  if (!dataUri || !dataUri.startsWith('data:audio/')) throw new Error('Expected a data URI for the audio.');

  const payload = {
    model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'audio_url', audio_url: { url: dataUri } }
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
    Authorization: `Bearer ${NV_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const resp = await axios.post(NV_API_URL, payload, { headers });
    return resp.data;
  } catch (error: any) {
    handleNvidiaAxiosError(error);
  }
}
