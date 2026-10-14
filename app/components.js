"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, Users, Settings, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { statusMeta } from "@/lib/supabase-helpers";
import { supabase } from "@/lib/supabase";

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
  const [status, setStatus] = useState(null); // from get_org_status()
  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/records", label: "Records", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  useEffect(() => {
    const checkSession = async (event) => {
      if (event.persisted) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) window.location.replace("/login");
      }
    };
    window.addEventListener("pageshow", checkSession);
    return () => window.removeEventListener("pageshow", checkSession);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.rpc("get_org_status");
      if (data && data[0]) setStatus(data[0]);
    })();
  }, []);

  const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
  const locked = status && !status.is_active;
  const hadPlan = status && status.plan_id;
  const sidebarNote = !status || status.is_upgraded ? null
    : locked ? (hadPlan ? "Plan ended — renew to continue" : "Trial ended — upgrade to continue")
    : status.plan_active ? `${status.plan_name} plan · ${daysLeft(status.plan_ends_at)} day${daysLeft(status.plan_ends_at) !== 1 ? "s" : ""} left`
    : `${daysLeft(status.trial_ends_at)} day${daysLeft(status.trial_ends_at) !== 1 ? "s" : ""} left in trial`;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F5F5F1" }}>
      <aside className="w-64 shrink-0 flex flex-col border-r" style={{ backgroundColor: "#16232E" }}>
        <div className="px-6 py-6 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "#D9A441" }}>
            <ShieldCheck size={18} color="#16232E" />
          </div>
          <div>
            <div className="text-white font-semibold text-[15px] leading-tight">Rule Watch</div>
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
        {sidebarNote && (
          <div className="mx-3 mb-4 px-3 py-2.5 rounded-lg text-xs" style={{ backgroundColor: locked ? "rgba(179,38,30,0.15)" : "rgba(217,164,65,0.1)", color: locked ? "#F87171" : "#D9A441" }}>
            {sidebarNote}
          </div>
        )}
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="px-8 py-5 border-b" style={{ borderColor: "#E4E2D8" }}>
          <h1 className="text-xl font-semibold" style={{ color: "#16232E" }}>{title}</h1>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{subtitle}</p>}
        </header>
        <div className="flex-1 overflow-auto px-8 py-6">
          {locked && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: "#FBEAE9", color: "#B3261E" }}>
              <AlertTriangle size={15} />
              {hadPlan
                ? "Your plan has ended. Renew to pick up right where you left off — everything you've added is safely saved and nothing is lost, but it stays paused until you renew."
                : "Your trial has ended. Upgrade to pick up right where you left off — everything you've added is safely saved and nothing is lost, but it stays paused until you upgrade."}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
