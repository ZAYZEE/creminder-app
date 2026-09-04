"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";
import { PlusCircle, X, Mail, Users, Copy, Check } from "lucide-react";

export default function Settings() {
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [invites, setInvites] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login");
    setEmail(session.user.email);
    const { data: member } = await supabase.from("org_members").select("org_id, organizations ( name )").eq("user_id", session.user.id).single();
    setOrg(member?.organizations);
    setOrgId(member?.org_id);

    const { data: rec } = await supabase.from("reminder_emails").select("id, email").eq("org_id", member?.org_id);
    setRecipients(rec || []);

    const { data: inv } = await supabase.from("invites").select("id, code, used_by, created_at").eq("org_id", member?.org_id).order("created_at", { ascending: false });
    setInvites(inv || []);
  };

  useEffect(() => { load(); }, []);

  const addRecipient = async () => {
    if (!newRecipient) return;
    await supabase.from("reminder_emails").insert({ org_id: orgId, email: newRecipient });
    setNewRecipient("");
    load();
  };

  const removeRecipient = async (id) => {
    await supabase.from("reminder_emails").delete().eq("id", id);
    load();
  };

  const generateInvite = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const code = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    await supabase.from("invites").insert({ org_id: orgId, code, created_by: session.user.id });
    load();
  };

  const copyLink = (id, code) => {
    const link = `${window.location.origin}/signup?invite=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

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
          <h2 className="font-medium text-sm mb-1 flex items-center gap-2" style={{ color: "#16232E" }}><Users size={15} /> Team</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
            Anyone who joins via an invite link gets full access to this account — add and manage records, same as you.
          </p>
          <button onClick={generateInvite} className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium mb-3" style={{ backgroundColor: "#D9A441", color: "#16232E" }}>
            <PlusCircle size={13} /> Generate invite link
          </button>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "#FAFAF7" }}>
                <span className="text-xs" style={{ color: inv.used_by ? "#9CA3AF" : "#16232E" }}>
                  {inv.used_by ? "Used ✓" : "Not used yet"} — created {new Date(inv.created_at).toLocaleDateString("en-IN")}
                </span>
                {!inv.used_by && (
                  <button onClick={() => copyLink(inv.id, inv.code)} className="text-xs flex items-center gap-1" style={{ color: "#B5750A" }}>
                    {copiedId === inv.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                  </button>
                )}
              </div>
            ))}
            {invites.length === 0 && <p className="text-xs" style={{ color: "#9CA3AF" }}>No invites generated yet.</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
          <h2 className="font-medium text-sm mb-1" style={{ color: "#16232E" }}>Reminder recipients</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
            Everyone added here gets notified by email when a document is 90, 60, 45, 30, 15, 7, or 1 day from expiring.
          </p>
          <div className="space-y-2 mb-3">
            {recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "#FAFAF7" }}>
                <span className="text-sm flex items-center gap-2" style={{ color: "#16232E" }}><Mail size={13} color="#9CA3AF" />{r.email}</span>
                <button onClick={() => removeRecipient(r.id)}><X size={14} color="#9CA3AF" /></button>
              </div>
            ))}
            {recipients.length === 0 && <p className="text-xs" style={{ color: "#9CA3AF" }}>None added.</p>}
          </div>
          <div className="flex gap-2">
            <input value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} placeholder="e.g. owner@youragency.com"
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }}
              onKeyDown={(e) => e.key === "Enter" && addRecipient()} />
            <button onClick={addRecipient} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1" style={{ backgroundColor: "#16232E", color: "white" }}>
              <PlusCircle size={14} /> Add
            </button>
          </div>
        </div>

        <button onClick={logout} className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Log out</button>
      </div>
    </Shell>
  );
}
