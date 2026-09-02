"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";

export default function Settings() {
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      setEmail(session.user.email);
      const { data: member } = await supabase.from("org_members").select("org_id, organizations ( name )").eq("user_id", session.user.id).single();
      setOrg(member?.organizations);
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <Shell title="Settings">
      <div className="max-w-lg space-y-6">
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: "#16232E" }}>Account</h2>
          <div className="text-sm space-y-2" style={{ color: "#4B5563" }}>
            <div className="flex justify-between"><span>Organization</span><span style={{ color: "#16232E" }}>{org?.name || "…"}</span></div>
            <div className="flex justify-between"><span>Email</span><span style={{ color: "#16232E" }}>{email}</span></div>
            <div className="flex justify-between"><span>Plan</span><span style={{ color: "#16232E" }}>Free</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
          <h2 className="font-medium text-sm mb-2" style={{ color: "#16232E" }}>Reminders</h2>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>Email/WhatsApp reminder scheduling isn't wired up yet in this MVP — noted as a next build step, not a working feature right now.</p>
        </div>
        <button onClick={logout} className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Log out</button>
      </div>
    </Shell>
  );
}
