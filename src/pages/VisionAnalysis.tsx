import { useState, useRef, useEffect, useCallback } from "react";
import { Image as ImageIcon, UploadCloud, Target, ShieldAlert, Zap, Download } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { downloadJSON, downloadPDF } from "../lib/utils";

export default function VisionAnalysis() {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "complete" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [authenticityAnalysis, setAuthenticityAnalysis] = useState<string | null>(null);
  const [isFake, setIsFake] = useState<boolean | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("Initializing model...");
  const workerRef = useRef<Worker | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event) => {
      const { status, result: workResult, type, error, data } = event.data;
      if (type === "detect_objects" || status === "progress") {
        if (status === "progress") {
          setProgress(`Loading model... ${data?.file ? data.file : ''} ${data?.progress ? Math.round(data.progress) + '%' : ''}`);
        } else if (status === "complete") {
          if (type === "detect_objects") {
            setResult(workResult);
            setStatus("complete");
            drawBoxes(workResult);
          }
        } else if (status === "error") {
          console.error("Worker error:", error);
          setErrorDetails(error);
          setStatus("error");
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setResult(null);
        setDescription(null);
        setAuthenticityAnalysis(null);
        setIsFake(null);
        setStatus("idle");
        // Clear canvas
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1
  });

  const visionAnalysisPrompt = 'Analyze the provided image in fluent, professional English. Return a detailed "Image Description" section with detected objects, key details, and photo style feel. Then return a "Deepfake / Manipulation Analysis" section with numbered findings and a clear conclusion. Use correct grammar, spelling, punctuation, and complete sentences.';

  const handleAnalyze = async () => {
    if (!image) return;
    setStatus("loading");
    setDescription(null);
    setAuthenticityAnalysis(null);
    setIsFake(null);
    
    // Call local worker for object detection
    workerRef.current?.postMessage({
      type: "detect_objects",
      image: image,
      id: Date.now()
    });

    try {
      const response = await fetch("/api/nvidia/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          prompt: visionAnalysisPrompt
        })
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (response.ok) {
          setDescription(data.description || JSON.stringify(data));
          setAuthenticityAnalysis(data.analysis || JSON.stringify(data));
          setIsFake(data.isFake ?? null);
        } else {
          console.error("Failed to describe image:", data.error);
          setDescription("Server analysis failed. " + (data.error || ""));
          setAuthenticityAnalysis("Error: " + (data.error || ""));
        }
      } else if (response.status === 413) {
        setDescription("Error: The image is too large to be processed by the server (Payload Too Large). Please upload a smaller image or compress it before uploading.");
        setAuthenticityAnalysis("Image too large for AI processing.");
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 50)}...`);
      }
    } catch (err: any) {
      console.error("API call error:", err);
      setDescription(err.message || "Failed to communicate with semantic analysis server.");
      setAuthenticityAnalysis("Analysis unavailable due to server communication error.");
    }
  };

  const handleAnalyzeNvidiaStream = async () => {
    if (!image) return;
    setStatus('loading');
    setDescription(null);
    setAuthenticityAnalysis('');
    setIsFake(null);

    try {
      const resp = await fetch('/api/nvidia/analyze-image-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          prompt: visionAnalysisPrompt
        })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Server error: ${resp.status} ${txt}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('Streaming not supported by server response.');

      const decoder = new TextDecoder();
      let done = false;
      let acc = '';
      let buffered = '';
      let parsedText = '';

      const processSseChunk = (chunkStr: string) => {
        buffered += chunkStr;
        const parts = buffered.split(/\r?\n\r?\n/);
        buffered = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payload);
              const choice = parsed.choices?.[0];
              const delta = choice?.delta;

              if (delta) {
                if (typeof delta.content === 'string') {
                  parsedText += delta.content;
                }
                if (typeof delta.reasoning === 'string') {
                  parsedText += delta.reasoning;
                }
              } else if (typeof parsed.text === 'string') {
                parsedText += parsed.text;
              } else if (typeof parsed.output === 'string') {
                parsedText += parsed.output;
              }
            } catch {
              // ignore invalid partial JSON
            }
          }
        }

        if (parsedText) {
          setAuthenticityAnalysis((prev) => (prev ? prev + parsedText : parsedText));
          parsedText = '';
        }
      };

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = !!streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          acc += chunk;
          processSseChunk(chunk);
        }
      }

      if (buffered) {
        processSseChunk('\n\n');
      }

      // Try to parse JSON at the end if the server returned a single JSON body instead of SSE
      try {
        const jsonStart = acc.indexOf('{');
        if (jsonStart !== -1) {
          const possible = acc.slice(jsonStart);
          const parsed = JSON.parse(possible);
          setDescription(parsed.description || null);
          if (!authenticityAnalysis) {
            setAuthenticityAnalysis(parsed.analysis || acc);
          }
          setIsFake(parsed.isFake ?? null);
        }
      } catch (e) {
        // ignore parse errors; leave accumulated text
      }

      setStatus('complete');
    } catch (err: any) {
      console.error('NVIDIA stream error:', err);
      setStatus('error');
      setDescription('NVIDIA analysis failed: ' + (err.message || 'Unknown'));
      setAuthenticityAnalysis(null);
    }
  };

  const drawBoxes = (detections: any[]) => {
    if (!imageRef.current || !canvasRef.current) return;
    
    const img = imageRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match image natural size for correct plotting
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    detections.forEach(det => {
      const { xmin, ymin, xmax, ymax } = det.box || { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };
      const { label, score } = det;
      
      // Draw Box
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
      
      // Draw Label Background
      ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
      ctx.fillRect(xmin, ymin - 30, (xmax - xmin) / 2 > 100 ? (xmax - xmin) / 2 : 120, 30);
      
      // Draw Label Text
      ctx.fillStyle = '#000000';
      ctx.font = '20px monospace';
      ctx.fillText(`${label} (${Math.round(score * 100)}%)`, xmin + 5, ymin - 8);
    });
  };

  const handleExport = () => {
    const report = {
      type: "Vision Analysis",
      timestamp: new Date().toISOString(),
      classification: isFake ? 'FAKE' : 'AUTHENTIC',
      authenticityAnalysis: authenticityAnalysis || "Pending",
      summary: description || "No semantic description available",
      objectsDetected: result || []
    };
    downloadJSON(report, `vision-analysis-report-${Date.now()}.json`);
  };

  const handleExportPDF = () => {
    const report = {
      type: "Vision Analysis",
      timestamp: new Date().toISOString(),
      classification: isFake ? 'FAKE' : 'AUTHENTIC',
      authenticityAnalysis: authenticityAnalysis || "Pending",
      summary: description || "No semantic description available",
      objectsDetected: result || []
    };
    downloadPDF(report, `vision-analysis-report-${Date.now()}.pdf`, 'Vision Analysis Report');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Target className="text-primary" size={32} />
          <h1 className="text-3xl font-bold text-white tracking-wide">Vision AI Engine</h1>
        </div>
        <p className="text-muted-foreground mt-2 font-mono">Local Object Detection & Deepfake Inspection Sandbox</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Image area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-mono flex items-center gap-2">
              <ImageIcon size={18} className="text-primary"/> Visual Feed Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!image ? (
              <div 
                {...getRootProps()} 
                className={`flex flex-col items-center justify-center h-96 border-2 border-dashed ${isDragActive ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-primary/50'} rounded-lg transition-colors cursor-pointer`}
              >
                <input {...getInputProps()} />
                <UploadCloud size={48} className="text-muted-foreground mb-4" />
                <p className="text-white font-mono text-sm text-center">Drag & drop image here<br/><span className="text-muted-foreground">or click to select</span></p>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/50 group">
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {setImage(null); setResult(null);}}>Clear</Button>
                  <Button size="sm" onClick={handleAnalyze} disabled={status === "loading"}>
                    {status === "loading" ? "Scanning..." : "Execute Scan"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleAnalyzeNvidiaStream} disabled={status === "loading"}>
                    Analyze (NVIDIA Stream)
                  </Button>
                </div>
                
                <div className="relative w-full h-[500px] flex items-center justify-center overflow-hidden">
                  {/* Base Image */}
                  <img 
                    ref={imageRef} 
                    src={image} 
                    alt="Upload" 
                    className="max-h-full max-w-full object-contain relative z-0"
                    onLoad={() => {
                        // Keep canvas overlay matching the image size exactly on screen
                        if (canvasRef.current && imageRef.current) {
                            // Dimensions handled during drawBoxes
                        }
                    }}
                  />
                  {/* Drawing Canvas */}
                  <canvas 
                    ref={canvasRef} 
                    className="absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                        width: imageRef.current ? `${imageRef.current.width}px` : '100%',
                        height: imageRef.current ? `${imageRef.current.height}px` : '100%'
                    }}
                  />
                  
                  {status === "loading" && (
                     <div className="absolute inset-0 z-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwMDAwIiBmaWxsLW9wYWNpdHk9IjAuNSIvPgo8L3N2Zz4=')]">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_15px_#06b6d4] animate-[scan_2s_ease-in-out_infinite]" />
                     </div>
                  )}
                  {status === "error" && (
                     <div className="absolute inset-0 z-30 pointer-events-none bg-red-500/10 mix-blend-overlay"></div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-sm">Threat Assessment & Deepfake Analysis</CardTitle>
            </CardHeader>
            <CardContent>
               {status === "idle" && (
                   <div className="h-24 flex items-center justify-center text-muted-foreground font-mono text-sm border-2 border-dashed border-white/5 rounded-md">
                   Awaiting image input...
                   </div>
               )}
               {status === "loading" && !authenticityAnalysis && <p className="text-xs text-primary font-mono animate-pulse">Running Authentication Engine securely via AI...</p>}
               {authenticityAnalysis && (
                   <div className="space-y-4">
                       <div className="p-4 rounded-md bg-white/5 border border-white/10 flex items-center flex-col justify-center">
                           <p className="text-xs text-muted-foreground font-mono mb-2">CLASSIFICATION</p>
                           <h2 className={`text-3xl font-bold uppercase tracking-wider ${isFake ? 'text-destructive neon-text-destructive' : 'text-primary neon-text-primary'}`}>
                               {isFake ? 'FAKE / AI GENERATED' : 'AUTHENTIC'}
                           </h2>
                       </div>
                       <div className="p-3 bg-secondary/10 border border-secondary/20 text-white rounded text-sm font-mono leading-relaxed whitespace-pre-wrap">
                           {authenticityAnalysis}
                       </div>
                   </div>
               )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-sm"><Zap className="inline mr-2 text-yellow-400" size={16}/>Detailed Image Description</CardTitle>
            </CardHeader>
            <CardContent>
               {status === "idle" && <p className="text-xs text-muted-foreground font-mono">Run scan to view server semantic description...</p>}
               {status === "loading" && !description && <p className="text-xs text-primary font-mono animate-pulse">Running Semantic Pipeline securely via AI...</p>}
               {description && (
                  <div className="p-3 bg-primary/10 border border-primary/20 text-white rounded text-sm font-mono leading-relaxed whitespace-pre-wrap">
                    {description}
                  </div>
               )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-sm"><Zap className="inline mr-2 text-yellow-400" size={16}/>Objects Detected</CardTitle>
            </CardHeader>
            <CardContent>
               {status === "error" && (
                  <div className="p-4 bg-destructive/10 border-2 border-dashed border-destructive/20 text-destructive rounded-md font-mono text-sm mb-4">
                    <p className="font-bold flex items-center gap-2 mb-2"><ShieldAlert size={18} /> Local Model Inference Failure</p>
                    <p className="mb-2 text-xs opacity-90">{errorDetails || "The local in-browser object detection model failed to process this image."}</p>
                    <div className="text-xs space-y-1 opacity-80 mt-3 pt-3 border-t border-destructive/20">
                      <p><strong>Potential causes & next steps:</strong></p>
                      <ul className="list-disc pl-4 space-y-1 mt-1">
                        <li>Model weights may still be downloading. Try executing the scan again.</li>
                        <li>The image format or resolution might be unsupported by the WebAssembly runtime.</li>
                        <li>Browser memory limits reached. Refreshing the page might resolve this.</li>
                      </ul>
                    </div>
                  </div>
               )}
               {status === "idle" && <p className="text-xs text-muted-foreground font-mono">Run scan to view local object detection...</p>}
               {status === "loading" && <p className="text-xs text-primary font-mono animate-pulse">{progress}</p>}
               {status === "complete" && result && (
                  <ul className="space-y-3 mt-2 font-mono text-sm">
                    {result.map((det: any, i: number) => (
                      <li key={i} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/10 hover:border-primary/50 transition-colors">
                        <span className="text-white capitalize">{det.label}</span>
                        <span className="text-primary text-xs px-2 py-1 bg-primary/10 rounded">{(det.score * 100).toFixed(1)}%</span>
                      </li>
                    ))}
                    {result.length === 0 && <li className="text-muted-foreground">No objects detected with high confidence.</li>}
                  </ul>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
      {status === 'complete' && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport} className="border-primary text-primary hover:bg-primary/10">
            <Download size={16} className="mr-2" /> Export JSON
          </Button>
          <Button variant="outline" onClick={handleExportPDF} className="border-primary text-primary hover:bg-primary/10">
            <Download size={16} className="mr-2" /> Export PDF
          </Button>
        </div>
      )}
    </div>
  );
}
