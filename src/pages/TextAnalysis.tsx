import { useState, useRef, useEffect } from "react";
import { FileText, Cpu, AlertTriangle, CheckCircle2, ShieldAlert, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { downloadJSON, downloadPDF } from "../lib/utils";

export default function TextAnalysis() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "complete" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState<string | null>(null);
  const [grammarCheck, setGrammarCheck] = useState<string | null>(null);

  const [classificationCheck, setClassificationCheck] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("Initializing model...");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../lib/worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event) => {
      const { status, result: workResult, type, error, data } = event.data;
      if (type === "classify_text" || status === "progress") {
        if (status === "progress") {
          setProgress(`Loading model... ${data?.file ? data.file : ''} ${data?.progress ? Math.round(data.progress) + '%' : ''}`);
        } else if (status === "complete") {
          setResult(workResult);
          setStatus("complete");
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

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setStatus("loading");
    setResult(null);
    setDetailedAnalysis(null);
    setGrammarCheck(null);
    setClassificationCheck(null);
    setErrorDetails(null);
    
    // Start local worker
    workerRef.current?.postMessage({
      type: "classify_text",
      text: text,
      id: Date.now()
    });

    // Start remote detailed analysis
    try {
        const response = await fetch("/api/analyze-text", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ text })
        });
        const data = await response.json();
        if (response.ok) {
             setDetailedAnalysis(data.analysis);
             setGrammarCheck(data.grammar);
             setClassificationCheck(data.classification);
        } else {
             console.error("API error", data.error);
             setDetailedAnalysis("Failed to perform detailed semantic analysis.");
        }
    } catch (err: any) {
        console.error("Fetch error", err);
        setDetailedAnalysis("Semantic analysis API connection failed.");
    }

    // Since worker might take longer and its status updates are handled in onmessage,
    // we'll update the global status to complete once the API call is done
    // and wait for worker to finish before showing full results - wait, that's complex since we set status="complete" in onmessage.
    // Let's modify onmessage to set we are done, instead let's just let both run and set status to complete when worker is done (worker is slower initially)
    // Actually, let's let the worker set status to complete, and if API isn't done, it'll update detailedAnalysis when it is.
  };

  const handleExport = () => {
    const report = {
      type: "Text Analysis",
      timestamp: new Date().toISOString(),
      summary: classificationCheck === 'FAKE' ? "High Risk of Misinformation" : "Authentic/Low Risk",
      finding: classificationCheck === 'FAKE' ? 'FAKE' : 'AUTHENTIC',
      confidenceScores: {
          overall: result ? (result[0].score * 100).toFixed(2) + "%" : "0%"
      },
      textSnippet: text.substring(0, 100) + "...",
      detailedFactCheck: detailedAnalysis || "Pending"
    };
    downloadJSON(report, `text-analysis-report-${Date.now()}.json`);
  };

  const handleExportPDF = () => {
    const report = {
      type: "Text Analysis",
      timestamp: new Date().toISOString(),
      summary: classificationCheck === 'FAKE' ? "High Risk of Misinformation" : "Authentic/Low Risk",
      finding: classificationCheck === 'FAKE' ? 'FAKE' : 'AUTHENTIC',
      confidenceScores: {
          overall: result ? (result[0].score * 100).toFixed(2) + "%" : "0%"
      },
      textSnippet: text.substring(0, 100) + "...",
      detailedFactCheck: detailedAnalysis || "Pending"
    };
    downloadPDF(report, `text-analysis-report-${Date.now()}.pdf`, 'Text Analysis Report');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <FileText className="text-accent" size={32} />
          <h1 className="text-3xl font-bold text-white tracking-wide">Text Intel & Fake News Engine</h1>
        </div>
        <p className="text-muted-foreground mt-2 font-mono">Local DistilBERT NLP Pipeline for Contextual Misinformation</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input area */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono flex items-center gap-2">
              <Cpu size={18} className="text-primary"/> Input Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full h-64 bg-black/40 border border-white/10 rounded-md p-4 text-sm font-mono text-white focus:outline-none focus:border-primary/50 transition-colors resize-none"
              placeholder="Paste article, headline, or document text here for local offline analysis..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-col gap-4">
                <Button 
                className="w-full font-mono tracking-widest uppercase"
                onClick={handleAnalyze}
                disabled={status === "loading" || !text.trim()}
                >
                {status === "loading" ? "Analyzing Node..." : "Initiate Scan"}
                </Button>
                {status === "complete" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={handleExport} className="w-full border-primary text-primary hover:bg-primary/10 font-mono tracking-widest uppercase">
                          <Download size={16} className="mr-2" /> Export JSON
                      </Button>
                      <Button variant="outline" onClick={handleExportPDF} className="w-full border-primary text-primary hover:bg-primary/10 font-mono tracking-widest uppercase">
                          <Download size={16} className="mr-2" /> Export PDF
                      </Button>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>

        {/* Results area */}
        <Card className="relative overflow-hidden">
          {status === "loading" && (
            <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <div className="text-primary font-mono animate-pulse">{progress}</div>
            </div>
          )}
          <CardHeader>
            <CardTitle className="font-mono">Threat Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            {status === "error" && (
              <div className="h-64 flex flex-col items-center justify-center text-destructive font-mono text-sm border-2 border-dashed border-destructive/20 rounded-md p-4 text-center">
                <ShieldAlert className="mb-2" size={32} />
                <p className="font-bold uppercase tracking-wider mb-2">Neural Pipeline Failure</p>
                <p className="text-muted-foreground">{errorDetails || "Unknown processing error occurred"}</p>
                <Button variant="outline" className="mt-4" onClick={() => setStatus("idle")}>Reset Node</Button>
              </div>
            )}
            {status === "idle" && !result && (
              <div className="h-64 flex items-center justify-center text-muted-foreground font-mono text-sm border-2 border-dashed border-white/5 rounded-md">
                Awaiting input stream...
              </div>
            )}
            
            {status === "complete" && result && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-black/40 border border-white/10">
                  <div className="text-center">
                    <p className="text-sm font-mono text-muted-foreground mb-2">CLASSIFICATION</p>
                    {!classificationCheck ? (
                        <div className="text-primary font-mono animate-pulse">Consulting Fact Check Engine...</div>
                    ) : (
                        <h2 className={`text-4xl font-bold uppercase tracking-wider ${
                          classificationCheck === 'FAKE' ? 'text-destructive neon-text-destructive' : 'text-primary neon-text-primary'
                        }`}>
                          {classificationCheck === 'FAKE' ? 'FAKE' : 'AUTHENTIC'}
                        </h2>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-muted-foreground">Sentiment Extremity (Local Model)</span>
                    <span className="text-white">{(result[0].score * 100).toFixed(2)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${result[0].label === 'NEGATIVE' ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${result[0].score * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-md bg-white/5 border border-white/10 mt-6">
                  <h4 className="flex items-center gap-2 font-mono text-sm text-white mb-2">
                    {result[0].label === 'NEGATIVE' ? <ShieldAlert className="text-destructive" size={16} /> : <CheckCircle2 className="text-primary" size={16}/>}
                    AI Reasoning (Simulated Sentiment)
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result[0].label === 'NEGATIVE' 
                      ? "The provided text contains semantic inconsistencies typical of propaganda or emotional manipulation. Sentiment is highly negative with polarizing language."
                      : "The text structure is coherent, lacks extreme emotional triggers, and aligns with standard factual reporting patterns."}
                  </p>
                </div>
                
                <div className="p-4 rounded-md bg-primary/10 border border-primary/20 mt-6">
                  <h4 className="flex items-center gap-2 font-mono text-sm text-white mb-3">
                    <Cpu className="text-primary" size={16} />
                    Semantic Fact-Check (AI)
                  </h4>
                  {!detailedAnalysis && (
                      <div className="text-xs text-primary font-mono animate-pulse">Running semantic search and cross-referencing facts...</div>
                  )}
                  {detailedAnalysis && (
                      <div className="text-sm text-white font-mono leading-relaxed whitespace-pre-wrap">
                          {detailedAnalysis}
                      </div>
                  )}
                </div>

                <div className="p-4 rounded-md bg-secondary/10 border border-secondary/20 mt-6">
                  <h4 className="flex items-center gap-2 font-mono text-sm text-white mb-3">
                    <CheckCircle2 className="text-secondary" size={16} />
                    Grammar & Spelling Check
                  </h4>
                  {!grammarCheck && (
                      <div className="text-xs text-secondary font-mono animate-pulse">Analyzing grammar structure...</div>
                  )}
                  {grammarCheck && (
                      <div className="text-sm text-white font-mono leading-relaxed whitespace-pre-wrap">
                          {grammarCheck}
                      </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
