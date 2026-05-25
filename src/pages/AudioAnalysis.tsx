import { useState, useRef, useEffect } from "react";
import { Mic, UploadCloud, Activity, ShieldAlert, Waves, Download } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { downloadJSON, downloadPDF } from "../lib/utils";

export default function AudioAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "complete">("idle");
  const animationRef = useRef<number>();
  
  // Audio visualization refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [audioAnalysisResult, setAudioAnalysisResult] = useState<any>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setStatus("idle");
      // Stop any existing animation
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      
      // Stop and reset audio
      if (audioRef.current) {
         audioRef.current.pause();
         audioRef.current.currentTime = 0;
      }
      
      // Clear canvas
      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext('2d');
         if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
         }
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "audio/*": [] },
    maxFiles: 1
  });

  const drawSpectrum = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      analyser.fftSize = 1024;
      const bufferLength = analyser.frequencyBinCount;
      const dataArrayTime = new Uint8Array(bufferLength);
      const dataArrayFreq = new Uint8Array(bufferLength);

      const draw = () => {
          animationRef.current = requestAnimationFrame(draw);
          analyser.getByteTimeDomainData(dataArrayTime);
          analyser.getByteFrequencyData(dataArrayFreq);

          // Darken the background slightly to create trail effect
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw frequency spectrum (background)
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
              const barHeight = dataArrayFreq[i] / 2; // scale

              // Color mapping based on frequency
              const hue = i / bufferLength * 360;
              ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.5)`;
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

              x += barWidth + 0.5;
          }

          // Draw time domain waveform (foreground)
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#c084fc'; // Secondary neon color
          ctx.beginPath();
          const sliceWidth = canvas.width * 1.0 / bufferLength;
          x = 0;
          for (let i = 0; i < bufferLength; i++) {
              const v = dataArrayTime[i] / 128.0;
              const y = v * (canvas.height / 2);

              if (i === 0) {
                  ctx.moveTo(x, y);
              } else {
                  ctx.lineTo(x, y);
              }
              x += sliceWidth;
          }
          ctx.stroke();
      };
      draw();
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus("loading");
    
    // Set up audio visualization
    if (audioRef.current) {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            analyserRef.current = audioContextRef.current.createAnalyser();
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
        drawSpectrum();
    }

    // Simulate Fake audio processing for Deepfake Detection
    setTimeout(() => {
        setStatus("complete");
        if (audioRef.current) {
            audioRef.current.pause();
        }
        // Let it continue drawing the decay for a moment, then stop
        setTimeout(() => {
           if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }, 1000);
    }, 4000);
  };

  const handleExport = () => {
      const report = {
          type: "Audio Analysis",
          timestamp: new Date().toISOString(),
          fileName: file?.name || "unknown",
          summary: "Audio Synthesis Detected",
          confidenceScores: {
              overallCloningProbability: "92.4%",
              frequencyCutoffArtifacts: 0.87,
              phaseDiscontinuities: 0.94,
              backgroundNoiseFloorConsistency: 0.62
          }
      };
      downloadJSON(report, `audio-analysis-report-${Date.now()}.json`);
  };

  const handleExportPDF = () => {
      const report = {
          type: "Audio Analysis",
          timestamp: new Date().toISOString(),
          fileName: file?.name || "unknown",
          summary: "Audio Synthesis Detected",
          confidenceScores: {
              overallCloningProbability: "92.4%",
              frequencyCutoffArtifacts: 0.87,
              phaseDiscontinuities: 0.94,
              backgroundNoiseFloorConsistency: 0.62
          }
      };
      downloadPDF(report, `audio-analysis-report-${Date.now()}.pdf`, 'Audio Analysis Report');
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
         audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Waves className="text-secondary" size={32} />
          <h1 className="text-3xl font-bold text-white tracking-wide">Audio Deepfake Detection</h1>
        </div>
        <p className="text-muted-foreground mt-2 font-mono">Spectrogram CNN & Voice Cloning Anomaly Analysis</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload & Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono flex items-center gap-2">
              <Mic size={18} className="text-primary"/> Audio Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file ? (
               <div 
                  {...getRootProps()} 
                  className={`flex flex-col items-center justify-center p-10 border-2 border-dashed ${isDragActive ? 'border-secondary bg-secondary/5' : 'border-white/10 hover:border-secondary/50'} rounded-lg transition-colors cursor-pointer`}
               >
                  <input {...getInputProps()} />
                  <UploadCloud size={48} className="text-muted-foreground mb-4" />
                  <p className="text-white font-mono text-sm text-center">Drop audio file (WAV/MP3)</p>
               </div>
            ) : (
               <div className="p-6 border border-white/10 rounded-lg bg-black/40">
                  <div className="flex justify-between items-center mb-4">
                     <div>
                        <p className="text-sm font-mono text-white truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                     </div>
                     <Button variant="outline" size="sm" onClick={() => {
                        setFile(null);
                        if (audioRef.current) {
                            audioRef.current.pause();
                        }
                     }}>Clear</Button>
                  </div>
                  
                  <audio 
                     ref={audioRef} 
                     src={URL.createObjectURL(file)} 
                     crossOrigin="anonymous" 
                     className="hidden"
                  />
                  <canvas 
                     ref={canvasRef}
                     width={400}
                     height={128}
                     className="w-full h-32 mt-6 rounded-md bg-black/60 border border-white/5"
                  />
               </div>
            )}
            
            <div className="flex gap-4">
               <Button 
                  className="flex-1 font-mono uppercase bg-secondary text-white border-secondary/50 hover:bg-secondary/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                  disabled={!file || status === 'loading'}
                  onClick={handleAnalyze}
               >
                  {status === 'loading' ? 'Analyzing Frequencies...' : 'Process Audio Intel'}
               </Button>
               <Button 
                  className="flex-1 font-mono uppercase bg-primary text-white border-primary/50 hover:bg-primary/40"
                  disabled={!file || status === 'loading'}
                  onClick={async () => {
                     // call NVIDIA proxy for audio (non-streaming)
                     if (!file) return;
                     setStatus('loading');
                     setAudioAnalysisResult(null);
                     const reader = new FileReader();
                     reader.onload = async (e) => {
                        const dataUri = e.target?.result as string;
                        try {
                          const resp = await fetch('/api/nvidia/analyze-audio', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ audio: dataUri, prompt: 'Transcribe and analyze audio for authenticity.' })
                          });
                          if (!resp.ok) {
                            const txt = await resp.text();
                            throw new Error(`Server error: ${resp.status} ${txt}`);
                          }
                          const json = await resp.json();
                          setAudioAnalysisResult(json);
                          setStatus('complete');
                        } catch (err: any) {
                          console.error('Audio NVIDIA error:', err);
                          setStatus('complete');
                          setAudioAnalysisResult({ error: err.message || 'Failed' });
                        }
                     };
                     reader.readAsDataURL(file);
                  }}
               >
                  Analyze (NVIDIA)
               </Button>
               {status === 'complete' && (
                  <div className="flex gap-3">
                     <Button variant="outline" onClick={handleExport} className="border-secondary text-secondary hover:bg-secondary/10">
                        <Download size={16} className="mr-2" /> Export JSON
                     </Button>
                     <Button variant="outline" onClick={handleExportPDF} className="border-secondary text-secondary hover:bg-secondary/10">
                        <Download size={16} className="mr-2" /> Export PDF
                     </Button>
                  </div>
               )}
            </div>

          </CardContent>
        </Card>

        {/* Results */}
        <Card className="relative overflow-hidden">
            {status === "loading" && (
                <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                <div className="w-16 h-16 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin" />
                <div className="text-secondary font-mono animate-pulse">Running Wav2Vec2 Pipeline...</div>
                </div>
            )}

            <CardHeader>
                <CardTitle className="font-mono text-sm uppercase">Authenticity Radar</CardTitle>
            </CardHeader>
            <CardContent>
                {status === "idle" && (
                    <div className="h-[250px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-md">
                        <span className="text-muted-foreground font-mono text-sm">Standby...</span>
                    </div>
                )}
                
                {status === "complete" && (
                    <div className="space-y-6">
                        <div className="p-6 rounded-lg bg-black/40 border border-destructive/20 relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <p className="text-sm font-mono text-muted-foreground mb-2">CLONING PROBABILITY</p>
                            <h2 className="text-5xl font-bold uppercase tracking-wider text-destructive neon-text-destructive">
                                92.4%
                            </h2>
                            <div className="mt-2 inline-flex items-center gap-2 bg-destructive/20 text-destructive text-xs font-mono px-3 py-1 rounded-full border border-destructive/30">
                                <ShieldAlert size={14} /> AI SYNTHESIS DETECTED
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-mono text-sm text-white">Spectrogram Anomalies</h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-mono mb-1">
                                        <span className="text-muted-foreground">Frequency Cutoff Artifacts</span>
                                        <span className="text-secondary">High (0.87)</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full"><div className="h-full bg-secondary rounded-full w-[87%]"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-mono mb-1">
                                        <span className="text-muted-foreground">Phase Discontinuities</span>
                                        <span className="text-secondary">Critical (0.94)</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full"><div className="h-full bg-secondary rounded-full w-[94%]"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-mono mb-1">
                                        <span className="text-muted-foreground">Background Noise Floor Consistency</span>
                                        <span className="text-yellow-500">Suspicious (0.62)</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full"><div className="h-full bg-yellow-500 rounded-full w-[62%]"></div></div>
                                </div>
                            </div>
                        </div>

                        {audioAnalysisResult && (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded text-sm font-mono whitespace-pre-wrap">
                            <strong>Audio AI Analysis Result:</strong>
                            <pre className="mt-2 text-xs">{JSON.stringify(audioAnalysisResult, null, 2)}</pre>
                          </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
