"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell, useLock } from "../components";
import { lockText } from "@/lib/lockInfo";
import { PlusCircle, X, Users, Copy, Check, UserMinus, AlertTriangle, Pencil } from "lucide-react";

export default function Settings() {
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [invites, setInvites] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState(null); // from get_org_status()
  const [renewal, setRenewal] = useState(null); // a renewal waiting to start, if any
  const { lock } = useLock();
  const lockMsg = lockText(lock, status);
  const locked = !!(status && !status.is_active);
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
    const { data: rv } = await supabase.rpc("get_renewal_info");
    setRenewal(rv && rv[0] ? rv[0] : null);

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

  const saveOrgName = async () => {
    setNameError("");
    setSavingName(true);
    const { data, error } = await supabase.rpc("rename_organization", { p_name: nameDraft });
    setSavingName(false);
    if (error) { setNameError(error.message); return; }
    setOrg((o) => ({ ...o, name: data }));
    setEditingName(false);
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
      const inGrace = new Date(status.plan_ends_at) <= Date.now();
      planTitle = inGrace ? `${status.plan_name} plan expired · grace period` : `${status.plan_name} plan`;
      planDetail = inGrace
        ? `Expired on ${fmtDate(status.plan_ends_at)}. Access continues for a short time.`
        : `Active until ${fmtDate(status.plan_ends_at)} · ${plural(daysLeft(status.plan_ends_at), "day")} left`;
      if (status.over_limit) {
        planLocked = true;
        planDetail = `Locked: over this plan's document limit. Active until ${fmtDate(status.plan_ends_at)}.`;
      }
      if (renewal && renewal.has_queued) {
        const rm = renewal.next_months === 1 ? "1 month" : `${renewal.next_months} months`;
        if (inGrace) {
          planTitle = `${status.plan_name} plan ended · renewal starting shortly`;
          planDetail = `Your ${renewal.next_plan_name} renewal (${rm}) starts automatically.`;
        } else {
          planDetail += ` · Renewal: ${renewal.next_plan_name}, ${rm}, starts when this plan ends`;
        }
      }
      if (status.doc_limit == null) {
        usageText = `${plural(status.docs_used, "document")} tracked · no limit on this plan`;
      } else {
        usagePct = Math.min(100, Math.round((status.docs_used / status.doc_limit) * 100));
        usageText = `${status.docs_used} of ${status.doc_limit} documents used`;
        if (status.docs_used > status.doc_limit) {
          usageColor = "#B3261E";
          usageWarning = `You're over this plan's limit by ${status.docs_used - status.doc_limit}. Your account stays locked until you delete that many or move to a bigger plan.`;
        } else if (status.docs_used >= status.doc_limit) {
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
    } else if (status.plan_id && status.plan_ends_at) {
      planLocked = true;
      planTitle = `${status.plan_name} plan ended`;
      planDetail = lock && lock.kind === "ended" && lock.deletionDate
        ? `Ended on ${fmtDate(status.plan_ends_at)}. ${lockMsg.body}`
        : `Ended on ${fmtDate(status.plan_ends_at)}. Everything you've added is safe and paused until you renew.`;
      usageText = `${plural(status.docs_used, "document")} saved`;
    } else {
      planLocked = true;
      planTitle = "Free trial ended";
      planDetail = lock && lock.kind === "trial"
        ? `Ended on ${fmtDate(status.trial_ends_at)}. ${lockMsg.body}`
        : `Ended on ${fmtDate(status.trial_ends_at)}. Everything you've added is safe and paused until you upgrade.`;
      usageText = `${plural(status.docs_used, "document")} saved`;
    }
  }

  return (
    <Shell title="Settings">
      <div className="max-w-lg space-y-6">
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E4E2D8" }}>
          <h2 className="font-medium text-sm mb-4" style={{ color: "#16232E" }}>Account</h2>
          <div className="text-sm space-y-2" style={{ color: "#4B5563" }}>
            {editingName ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0">Organization</span>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={80} autoFocus
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: "#E4E2D8", color: "#16232E" }} />
                  <button onClick={saveOrgName} disabled={savingName} className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ backgroundColor: "#16232E", color: "white" }}>{savingName ? "Saving…" : "Save"}</button>
                  <button onClick={() => { setEditingName(false); setNameError(""); }} className="text-xs px-2 py-1.5" style={{ color: "#6B7280" }}>Cancel</button>
                </div>
                {nameError && <div className="text-xs mt-1" style={{ color: "#B3261E" }}>{nameError}</div>}
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span>Organization</span>
                <span className="flex items-center gap-2" style={{ color: "#16232E" }}>
                  {org?.name || "…"}
                  {isOwner && !locked && (
                    <button onClick={() => { setNameDraft(org?.name || ""); setNameError(""); setEditingName(true); }} className="text-gray-300 hover:text-gray-600 transition" title="Rename organization"><Pencil size={13} /></button>
                  )}
                </span>
              </div>
            )}
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
            {!status.is_upgraded && (
              <button onClick={() => router.push("/upgrade")} className="mt-4 text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#16232E", color: "white" }}>
                View plans &amp; upgrade
              </button>
            )}
          </div>
        )}

        {/* Team section — only rendered for owners at all. Members never see this section, not even a placeholder message. */}
        {isOwner && !locked && (
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
