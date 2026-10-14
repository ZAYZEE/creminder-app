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
  const [status, setStatus] = useState(null); // from get_org_status()
  const [confirmRemove, setConfirmRemove] = useState(null); // { user_id, email }
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login");
    setEmail(session.user.email);
    const { data: member } = await supabase.from("org_members").select("org_id, role, organizations ( name )").eq("user_id", session.user.id).single();
    setOrg(member?.organizations);
    setOrgId(member?.org_id);
    setIsOwner(member?.role === "owner");

    const { data: st } = await supabase.rpc("get_org_status");
    if (st && st[0]) setStatus(st[0]);

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

  const changePassword = async () => {
    setPwError("");
    setPwSuccess(false);
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) setPwError(error.message);
    else {
      setPwSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
  const plural = (n, word) => `${n} ${word}${n !== 1 ? "s" : ""}`;

  let planTitle = "";
  let planDetail = "";
  let planLocked = false;
  let usageText = "";
  let usagePct = null;
  let usageColor = "#1F6B4A";
  let usageWarning = "";
  if (status) {
    if (status.is_upgraded) {
      planTitle = "Complimentary access";
      planDetail = "No expiry date or document limit on this account.";
      usageText = `${plural(status.docs_used, "document")} tracked`;
    } else if (status.plan_active) {
      planTitle = `${status.plan_name} plan`;
      planDetail = `Active until ${fmtDate(status.plan_ends_at)} · ${plural(daysLeft(status.plan_ends_at), "day")} left`;
      if (status.doc_limit == null) {
        usageText = `${plural(status.docs_used, "document")} tracked · no limit on this plan`;
      } else {
        usagePct = Math.min(100, Math.round((status.docs_used / status.doc_limit) * 100));
        usageText = `${status.docs_used} of ${status.doc_limit} documents used`;
        if (status.docs_used >= status.doc_limit) {
          usageColor = "#B3261E";
          usageWarning = "You've reached this plan's document limit. Move to a higher plan to add more.";
        } else if (usagePct >= 80) {
          usageColor = "#B5750A";
          usageWarning = "You're close to this plan's document limit.";
        }
      }
    } else if (status.in_trial) {
      planTitle = "Free trial";
      planDetail = `Ends ${fmtDate(status.trial_ends_at)} · ${plural(daysLeft(status.trial_ends_at), "day")} left`;
      usageText = `${plural(status.docs_used, "document")} added · no limit during the trial`;
    } else if (status.plan_id) {
      planLocked = true;
      planTitle = `${status.plan_name} plan ended`;
      planDetail = `Ended on ${fmtDate(status.plan_ends_at)}. Everything you've added is safe and paused until you renew.`;
      usageText = `${plural(status.docs_used, "document")} saved`;
    } else {
      planLocked = true;
      planTitle = "Free trial ended";
      planDetail = `Ended on ${fmtDate(status.trial_ends_at)}. Everything you've added is safe and paused until you upgrade.`;
      usageText = `${plural(status.docs_used, "document")} saved`;
    }
  }

  return (
    <Shell title="Settings">
      <div className="max-w-lg space-y-6">
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: "#16232E" }}>Account</h2>
          <div className="text-sm space-y-2" style={{ color: "#4B5563" }}>
            <div className="flex justify-between"><span>Organization</span><span style={{ color: "#16232E" }}>{org?.name || "…"}</span></div>
            <div className="flex justify-between"><span>Email</span><span style={{ color: "#16232E" }}>{email}</span></div>
            <div className="flex justify-between"><span>Role</span><span style={{ color: "#16232E" }}>{isOwner ? "Owner" : "Member"}</span></div>
          </div>
        </div>

        {status && (
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: planLocked ? "#F3C9C6" : "#E4E2D8" }}>
            <h2 className="font-medium text-sm mb-3" style={{ color: "#16232E" }}>Plan &amp; usage</h2>
            <div className="text-sm font-medium" style={{ color: planLocked ? "#B3261E" : "#16232E" }}>{planTitle}</div>
            <div className="text-xs mt-0.5 mb-4" style={{ color: planLocked ? "#B3261E" : "#6B7280" }}>{planDetail}</div>
            <div className="text-xs mb-1.5" style={{ color: "#4B5563" }}>{usageText}</div>
            {usagePct !== null && (
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#EEEDE6" }}>
                <div className="h-full rounded-full" style={{ width: `${usagePct}%`, backgroundColor: usageColor }} />
              </div>
            )}
            {usageWarning && <div className="text-xs mt-2" style={{ color: usageColor }}>{usageWarning}</div>}
          </div>
        )}

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

        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: "#16232E" }}>Change password</h2>
          {pwSuccess ? (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#E7F3ED", color: "#1F6B4A" }}>Password updated.</p>
          ) : (
            <div className="space-y-3">
              <input type="password" placeholder="New password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
              <input type="password" placeholder="Confirm new password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
              {pwError && <p className="text-xs text-red-600">{pwError}</p>}
              <button disabled={pwSaving} onClick={changePassword} className="text-sm px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          )}
        </div>

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
