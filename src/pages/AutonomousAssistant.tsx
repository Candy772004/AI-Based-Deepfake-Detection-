import { useState, useRef, useEffect } from "react";
import { MessageSquare, Terminal, ShieldAlert, CheckCircle2, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface Message {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
}

export default function AutonomousAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "system", content: "DeepGuard Autonomous Agent initialized. Local LLM loaded into memory (simulated)." },
    { id: "2", role: "system", content: "RAG Pipeline connected to vector_db." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate local LLM response
    setTimeout(() => {
        setIsTyping(false);
        const aiMsg: Message = { 
            id: (Date.now() + 1).toString(), 
            role: "ai", 
            content: "Analyzing local vector database... According to the recent offline scan, the anomaly detected in T-004 indicates a high probability of a GAN-based injection attack on layer 4 of the neural network. I recommend deploying isolating node protocol immediately." 
        };
        setMessages(prev => [...prev, aiMsg]);
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <header className="flex-shrink-0">
        <div className="flex items-center gap-3">
          <Terminal className="text-primary" size={32} />
          <h1 className="text-3xl font-bold text-white tracking-wide">Offline Intelligence Agent</h1>
        </div>
        <p className="text-muted-foreground mt-2 font-mono">Conversational interface for local threat intelligence and RAG queries.</p>
      </header>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="py-3 px-6 bg-white/5 flex flex-row items-center justify-between border-b border-primary/20">
             <CardTitle className="font-mono text-sm flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary animate-pulse"/>
                 MODEL: LOCAL-LLAMA-3-7B-INT4
             </CardTitle>
             <div className="flex items-center gap-2">
                 <ShieldAlert className="text-primary opacity-50" size={16}/>
                 <span className="text-xs font-mono text-muted-foreground">AIRGAPPED ENVIRONMENT</span>
             </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'system' ? (
                         <div className="w-full text-center py-2">
                            <span className="text-[10px] font-mono text-primary/60 px-3 py-1 bg-primary/5 border border-primary/10 rounded uppercase">
                                [ SYSTEM ]: {msg.content}
                            </span>
                         </div>
                    ) : (
                        <div className={`max-w-[80%] rounded-xl p-4 font-mono text-sm ${
                            msg.role === 'user' 
                              ? 'bg-primary/20 border border-primary/30 text-white ml-auto'
                              : 'bg-white/5 border border-white/10 text-slate-100'
                        }`}>
                            {msg.role === 'ai' && <div className="text-[10px] text-primary mb-2 border-b border-primary/20 pb-1 flex items-center gap-1"><CheckCircle2 size={12}/> VETTED BY LOCAL AI</div>}
                            <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    )}
                </div>
            ))}
            
            {isTyping && (
                <div className="max-w-[80%] rounded-lg p-4 font-mono text-sm bg-black/60 border border-white/10 text-muted-foreground w-fit flex gap-1">
                    <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay:'0.1s'}}>.</span><span className="animate-bounce" style={{animationDelay:'0.2s'}}>.</span>
                </div>
            )}
        </CardContent>

        <div className="p-4 border-t border-white/10 bg-black/40">
           <form onSubmit={handleSubmit} className="relative flex items-center">
              <ChevronRight className="absolute left-3 text-primary" size={20} />
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query local intelligence or analyze logs..."
                className="w-full bg-white/5 border border-white/10 rounded-md py-3 pl-10 pr-12 text-sm font-mono text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-2 p-1.5 bg-primary/20 text-primary rounded border border-primary/30 hover:bg-primary/40 disabled:opacity-50 transition-colors"
               >
                 <MessageSquare size={16} />
              </button>
           </form>
        </div>
      </Card>
    </div>
  );
}
