import { Outlet, NavLink } from "react-router-dom";
import { Activity, Type, Image as ImageIcon, Video, Mic, ShieldAlert, Cpu } from "lucide-react";
import { cn } from "../lib/utils";

const links = [
  { to: "/", icon: <Activity size={20} />, label: "Dashboard" },
  { to: "/text", icon: <Type size={20} />, label: "Text Intel" },
  { to: "/vision", icon: <ImageIcon size={20} />, label: "Vision AI" },
  { to: "/video", icon: <Video size={20} />, label: "Video Forensic" },
  { to: "/audio", icon: <Mic size={20} />, label: "Audio Analysis" },
  { to: "/assistant", icon: <Cpu size={20} />, label: "Local Agent" },
];

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]"></div>
      </div>
      
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-white/10 glass z-10 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <ShieldAlert className="text-primary" size={28} />
          <h1 className="text-xl font-bold tracking-wider neon-text-primary uppercase">DeepGuard AI</h1>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border",
                  isActive
                    ? "bg-primary/20 text-[--color-primary] border-primary/30"
                    : "text-slate-400 hover:bg-white/5 border-transparent"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? "text-[--color-primary]" : ""}>
                    {link.icon}
                  </span>
                  <span className="font-medium tracking-wide">{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="glass-panel p-4 rounded-xl flex items-center justify-between text-xs font-mono">
            <div>
              <div className="text-primary mb-1 text-[10px] uppercase font-bold tracking-wider">SYSTEM STATUS</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-400">SECURE (LOCAL)</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative h-screen overflow-y-auto">
        <div className="p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
