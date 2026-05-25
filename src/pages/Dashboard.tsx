import { useEffect, useState } from "react";
import { Activity, ShieldAlert, Zap, Cpu, Server, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const performanceData = Array.from({ length: 20 }, (_, i) => ({
  time: i,
  cpu: Math.floor(Math.random() * 40) + 20,
  memory: Math.floor(Math.random() * 30) + 40,
}));

const threatData = Array.from({ length: 10 }, (_, i) => ({
  name: `T-${i}`,
  score: Math.random(),
}));

export default function Dashboard() {
  const [data, setData] = useState(performanceData);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((currentData) => {
        const newData = [...currentData.slice(1)];
        const lastTime = newData[newData.length - 1].time;
        newData.push({
          time: lastTime + 1,
          cpu: Math.floor(Math.random() * 60) + 10,
          memory: Math.floor(Math.random() * 20) + 50,
        });
        return newData;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold neon-text-primary tracking-wide">DeepGuard Nexus</h1>
        <p className="text-muted-foreground mt-2 font-mono">Global Threat & AI Intelligence Overview</p>
      </header>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Models" value="12" icon={<Cpu className="text-primary" />} />
        <StatCard title="Nodes Online" value="48" icon={<Server className="text-secondary" />} />
        <StatCard title="Threats Blocked" value="1,204" icon={<ShieldAlert className="text-accent" />} />
        <StatCard title="Inference Latency" value="14ms" icon={<Zap className="text-yellow-400" />} />
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-mono flex items-center gap-2">
              <Activity className="text-primary animate-pulse" size={18} />
              System Resource Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" />
                  <YAxis stroke="rgba(255,255,255,0.2)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.1)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                  <Area type="monotone" dataKey="memory" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono flex items-center gap-2">
              <Network className="text-secondary" size={18} />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertItem type="Deepfake Video" risk={0.94} time="2m ago" />
            <AlertItem type="Phishing PDF" risk={0.88} time="15m ago" />
            <AlertItem type="Fake News (Text)" risk={0.72} time="1h ago" />
            <AlertItem type="Voice Clone Attempt" risk={0.96} time="2h ago" />
            <AlertItem type="Network Anomaly" risk={0.45} time="3h ago" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-mono mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-wider">{value}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-full border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertItem({ type, risk, time }: { type: string; risk: number; time: string }) {
  const isHigh = risk > 0.8;
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
      <div>
        <p className="text-sm font-medium">{type}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
      <div className={`text-sm font-mono px-2 py-1 rounded bg-black/40 border ${isHigh ? 'border-destructive text-destructive' : 'border-yellow-500 text-yellow-500'}`}>
        Risk: {(risk * 100).toFixed(0)}%
      </div>
    </div>
  );
}
