"use client";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGrid, Users, Settings, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { statusMeta } from "@/lib/supabase-helpers";

export function Badge({ status }) {
  const m = statusMeta[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: m.color, backgroundColor: m.bg }}>
      {status === "expired" && <AlertTriangle size={12} />}
      {status === "urgent" && <Clock size={12} />}
      {m.label}
    </span>
  );
}

export function Shell({ children, title, subtitle }) {
  const router = useRouter();
  const pathname = usePathname();
  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/records", label: "Records", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F5F5F1" }}>
      <aside className="w-64 shrink-0 flex flex-col border-r" style={{ backgroundColor: "#16232E" }}>
        <div className="px-6 py-6 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "#D9A441" }}>
            <ShieldCheck size={18} color="#16232E" />
          </div>
          <div>
            <div className="text-white font-semibold text-[15px] leading-tight">Meyaad</div>
            <div className="text-[11px] text-white/40 leading-tight">expiry tracking</div>
          </div>
        </div>
        <nav className="flex-1 px-3 mt-2 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <button key={n.href} onClick={() => router.push(n.href)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition"
                style={{ backgroundColor: active ? "rgba(217,164,65,0.12)" : "transparent", color: active ? "#D9A441" : "rgba(255,255,255,0.65)" }}>
                <Icon size={17} /> {n.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="px-8 py-5 border-b" style={{ borderColor: "#E4E2D8" }}>
          <h1 className="text-xl font-semibold" style={{ color: "#16232E" }}>{title}</h1>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{subtitle}</p>}
        </header>
        <div className="flex-1 overflow-auto px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
