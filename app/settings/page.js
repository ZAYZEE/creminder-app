"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";
import { PlusCircle, X, Users, Copy, Check, UserMinus, AlertTriangle } from "lucide-react";

export default function Settings() {
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [invites, setInvites] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [confirmRemove, setConfirmRemove] = useState(null); // { user_id, email }

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login");
    setEmail(session.user.email);
    const { data: member } = await supabase.from("org_members").select("org_id, role, organizations ( name )").eq("user_id", session.user.id).single();
    setOrg(member?.organizations);
    setOrgId(member?.org_id);
    setIsOwner(member?.role === "owner");

    if (member?.role === "owner") {
      const { data: inv } = await supabase.from("invites").select("id, code, revoked, created_at").eq("org_id", member?.org_id).order("created_at", { ascending: false });
      setInvites(inv || []);
      const { data: mem } = await supabase.rpc("get_org_members");
      setMembers(mem || []);
    }
  };

  useEffect(() => { load(); }, []);

  const generateInvite = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const code = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    await supabase.from("invites").insert({ org_id: orgId, code, created_by: session.user.id });
    load();
  };

  const revokeInvite = async (id) => {
    await supabase.from("invites").update({ revoked: true }).eq("id", id);
    load();
  };

  const removeMember = async () => {
    const { error } = await supabase.rpc("remove_org_member", { target_user_id: confirmRemove.user_id });
    if (error) {
      alert(error.message); // simple surfaced error — e.g. if something unexpected blocks removal
    }
    setConfirmRemove(null);
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
            <div className="flex justify-between"><span>Role</span><span style={{ color: "#16232E" }}>{isOwner ? "Owner" : "Member"}</span></div>
            <div className="flex justify-between"><span>Plan</span><span style={{ color: "#16232E" }}>Free</span></div>
          </div>
        </div>

        {/* Team section — only rendered for owners at all. Members never see this section, not even a placeholder message. */}
        {isOwner && (
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
            <h2 className="font-medium text-sm mb-1 flex items-center gap-2" style={{ color: "#16232E" }}><Users size={15} /> Team</h2>
            <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
              Anyone who joins via an invite link gets full access to this account — add and manage records, same as you.
            </p>

            <div className="space-y-2 mb-4">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "#FAFAF7" }}>
                  <div>
                    <span className="text-sm" style={{ color: "#16232E" }}>{m.email}</span>
                    <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ backgroundColor: m.role === "owner" ? "#D9A44120" : "#E4E2D8", color: m.role === "owner" ? "#8A5D00" : "#6B7280" }}>{m.role}</span>
                  </div>
                  {m.role !== "owner" && (
                    <button onClick={() => setConfirmRemove({ user_id: m.user_id, email: m.email })} className="text-xs flex items-center gap-1" style={{ color: "#B3261E" }}>
                      <UserMinus size={12} /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={generateInvite} className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium mb-3" style={{ backgroundColor: "#D9A441", color: "#16232E" }}>
              <PlusCircle size={13} /> Generate invite link
            </button>
            <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>Links are reusable by anyone who has them until you revoke them below.</p>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "#FAFAF7" }}>
                  <span className="text-xs" style={{ color: inv.revoked ? "#9CA3AF" : "#16232E" }}>
                    {inv.revoked ? "Revoked" : "Active"} — created {new Date(inv.created_at).toLocaleDateString("en-IN")}
                  </span>
                  <div className="flex items-center gap-3">
                    {!inv.revoked && (
                      <>
                        <button onClick={() => copyLink(inv.id, inv.code)} className="text-xs flex items-center gap-1" style={{ color: "#B5750A" }}>
                          {copiedId === inv.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                        </button>
                        <button onClick={() => revokeInvite(inv.id)} className="text-xs" style={{ color: "#B3261E" }}>Revoke</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {invites.length === 0 && <p className="text-xs" style={{ color: "#9CA3AF" }}>No invites generated yet.</p>}
            </div>
          </div>
        )}

                <button onClick={logout} className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Log out</button>
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} color="#B3261E" /><h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Remove team member?</h3></div>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              {confirmRemove.email} will immediately lose access to this account. They can be re-invited later with a new link.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={removeMember} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#B3261E", color: "white" }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
