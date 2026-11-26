// Works out why an account is locked (if it is) and the wording for each case.
// kind: "over"  = running plan but more documents than the plan allows
//       "trial" = free trial ended and no plan paid for yet (account is deleted after the waiting period)
//       "ended" = a paid plan has ended

const fmtDay = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function lockInfo(status, deletionDate) {
  if (!status || status.is_active) return null;
  const over = !!(status.plan_active && status.over_limit);
  const unpaid = !!deletionDate;
  const daysToDelete = deletionDate ? Math.max(0, Math.ceil((new Date(deletionDate) - Date.now()) / 86400000)) : null;
  return {
    kind: over ? "over" : status.plan_ends_at ? "ended" : unpaid ? "trial" : "ended",
    deletionDate: deletionDate || null,
    daysToDelete,
    excess: over ? Math.max(0, status.docs_used - status.doc_limit) : 0,
  };
}

export function lockText(lock, status) {
  if (!lock) return null;
  if (lock.kind === "over") {
    const n = lock.excess;
    const docs = `${n} document${n !== 1 ? "s" : ""}`;
    return {
      title: "Your account is locked: over your plan's limit",
      body: `You have ${status.docs_used} documents, but your ${status.plan_name} plan allows ${status.doc_limit}. Delete ${docs} or move to a bigger plan to unlock your account. Nothing has been lost.`,
      short: `Locked — delete ${docs} to continue`,
    };
  }
  if (lock.kind === "trial") {
    const d = lock.daysToDelete;
    const when = d > 0 ? `in ${d} day${d !== 1 ? "s" : ""}` : "within the next day";
    return {
      title: "Your free trial has ended",
      body: `Choose and pay for a plan to unlock your account. If you don't, your account and all its data will be permanently deleted ${when} (${fmtDay(lock.deletionDate)}). Until then you can only view names and delete.`,
      short: d > 0 ? `Trial ended — choose a plan within ${d} day${d !== 1 ? "s" : ""} or your data is deleted` : "Trial ended — choose a plan today or your data is deleted",
    };
  }
  if (lock.deletionDate) {
    const d = lock.daysToDelete;
    const when = d > 0 ? `in ${d} day${d !== 1 ? "s" : ""}` : "within the next day";
    return {
      title: "Your plan has ended",
      body: `Renew to unlock your account. If you don't, your account and all its data will be permanently deleted ${when} (${fmtDay(lock.deletionDate)}). Until then you can only view names and delete.`,
      short: d > 0 ? `Plan ended — renew within ${d} day${d !== 1 ? "s" : ""} or your data is deleted` : "Plan ended — renew today or your data is deleted",
    };
  }
  return {
    title: "Your plan has ended",
    body: "Renew to unlock your account. Everything you've added is safe, but it stays paused until you renew.",
    short: "Plan ended — renew to continue",
  };
}
