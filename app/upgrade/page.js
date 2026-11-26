"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";
import { X, AlertTriangle } from "lucide-react";

const PERIODS = [1, 6, 12];
const rupees = (n) => "₹" + Number(n).toLocaleString("en-IN");
const dateFmt = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const addMonths = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d; };

export default function Upgrade() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState({});
  const [status, setStatus] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState([]);
  const [months, setMonths] = useState(12);
  const [quotes, setQuotes] = useState({});
  const [confirm, setConfirm] = useState(null); // { plan, quote }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [mode, setMode] = useState("upgrade"); // "upgrade" or "renew"
  const [renewal, setRenewal] = useState(null); // from get_renewal_info()

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
    setEmail(session.user.email);
    const [p, s, st, member, pend, rv] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("app_settings").select("key, value, text_value"),
      supabase.rpc("get_org_status"),
      supabase.from("org_members").select("role").eq("user_id", session.user.id).single(),
      supabase.from("upgrade_requests").select("plan_id, months, amount, created_at, kind").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      supabase.rpc("get_renewal_info"),
    ]);
    setPlans(p.data || []);
    const map = {};
    (s.data || []).forEach((r) => { map[r.key] = r; });
    setSettings(map);
    if (st.data && st.data[0]) setStatus(st.data[0]);
    setIsOwner(member.data?.role === "owner");
    setPending(pend.data || []);
    setRenewal(rv.data && rv.data[0] ? rv.data[0] : null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const renew = mode === "renew" && !!(renewal && renewal.can_queue);

  // The database works out price, credit and balance, so what you see is what you're charged
  useEffect(() => {
    if (!plans.length) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(plans.map((p) => supabase.rpc(renew ? "quote_renewal" : "quote_plan", { p_plan_id: p.id, p_months: months })));
      if (cancelled) return;
      const map = {};
      plans.forEach((p, i) => { const row = results[i].data && results[i].data[0]; if (row) map[p.id] = row; });
      setQuotes(map);
    })();
    return () => { cancelled = true; };
  }, [plans, months, status, renew]);

  const discountFor = (m) =>
    m === 6 ? Number(settings.prepay_discount_6_months?.value || 0)
    : m === 12 ? Number(settings.prepay_discount_12_months?.value || 0)
    : 0;
  const paymentLink = settings.payment_link_url?.text_value || "";
  const planName = (id) => plans.find((p) => p.id === id)?.name || "";
  const running = !!(status && status.plan_active);
  const runningEnd = running ? new Date(status.plan_ends_at) : null;
  const inGrace = running && runningEnd <= new Date();
  const periodAllowed = (m) => renew || !running || (status.plan_months ? m >= status.plan_months : addMonths(m) >= runningEnd);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const { data, error: err } = await supabase.rpc(renew ? "request_renewal" : "request_plan", { p_plan_id: confirm.plan.id, p_months: months });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    const row = data && data[0];
    setDone({ name: row?.out_plan_name || confirm.plan.name, months, amount: row?.out_amount ?? confirm.quote.out_amount, renew });
    setConfirm(null);
    load();
  };

  return (
    <Shell title="Plans" subtitle="Pick a plan that fits the number of documents you track.">
      {loading ? (
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Loading…</p>
      ) : (
        <div className="space-y-5">
          {!isOwner && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#FAF6E0", color: "#8A6D00" }}>
              Only the account owner can change the plan. Ask them to choose one here.
            </div>
          )}

          {running && !renew && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#F5F5F1", color: "#4B5563" }}>
              Your {status.plan_name} plan {inGrace ? "has expired (grace period)" : `runs until ${dateFmt(runningEnd)}`}. You can move to a bigger plan with a period at least as long as your current plan's. It starts a fresh period today, and the unused days on your current plan are credited against the price (only fully completed days count as used). Choosing a smaller plan opens once your current plan ends.{renewal && renewal.can_queue ? " To keep your service going without a gap, use Renew." : ""}
            </div>
          )}

          {renewal && renewal.has_queued && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#E7F3ED", color: "#1F6B4A" }}>
              <div className="font-medium">Renewal waiting: {renewal.next_plan_name} plan, {renewal.next_months === 1 ? "1 month" : `${renewal.next_months} months`}</div>
              <div className="mt-0.5">It starts automatically when your current plan ends. You can still upgrade in the meantime.</div>
            </div>
          )}

          {running && renewal && renewal.can_queue && (
            <div className="flex gap-2">
              {[["upgrade", "Upgrade"], ["renew", "Renew"]].map(([k, label]) => (
                <button key={k} onClick={() => setMode(k)} className="text-sm px-4 py-2 rounded-lg border transition"
                  style={{ borderColor: mode === k ? "#16232E" : "#E4E2D8", backgroundColor: mode === k ? "#16232E" : "white", color: mode === k ? "white" : "#4B5563" }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {renew && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#F5F5F1", color: "#4B5563" }}>
              Pay now and your new plan starts automatically when your current plan ends, with no break in service. Any plan and any length can be chosen. A renewal has no credit, so you pay the full price, and once paid it can't be changed.
            </div>
          )}

          {done && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#E7F3ED", color: "#1F6B4A" }}>
              <div className="font-medium">Request received: {done.name} plan{done.renew ? " renewal" : ""}, {done.months === 1 ? "1 month" : `${done.months} months`} — {rupees(done.amount)} to pay</div>
              <div className="mt-0.5">
                {paymentLink
                  ? (done.renew ? "Complete your payment on the payment page. Your renewal is set up once we confirm it, and starts when your current plan ends." : "Complete your payment on the payment page. Your plan starts once we confirm it.")
                  : (done.renew ? `We'll contact you at ${email} with payment details. Your renewal is set up once we confirm your payment, and starts when your current plan ends.` : `We'll contact you at ${email} with payment details. Your plan starts once we confirm your payment.`)}
              </div>
              {paymentLink && (
                <a href={paymentLink} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#16232E", color: "white" }}>
                  Open payment page
                </a>
              )}
            </div>
          )}

          {!done && pending.map((pr, i) => (
            <div key={i} className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#FAF6E0", color: "#8A6D00" }}>
              <div className="font-medium">Open request: {planName(pr.plan_id)} plan{pr.kind === "renewal" ? " (renewal)" : ""}, {pr.months === 1 ? "1 month" : `${pr.months} months`} — {rupees(pr.amount)} to pay</div>
              <div className="mt-0.5">Waiting for payment confirmation. Choosing a different {pr.kind === "renewal" ? "renewal" : "plan"} below replaces this request.</div>
              {paymentLink && (
                <a href={paymentLink} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#16232E", color: "white" }}>
                  Open payment page
                </a>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            {PERIODS.map((m) => {
              const d = discountFor(m);
              const active = months === m;
              const allowed = periodAllowed(m);
              return (
                <button key={m} disabled={!allowed} onClick={() => setMonths(m)}
                  title={allowed ? undefined : `Too short: the new plan's period must be at least as long as your current plan's${status.plan_months ? ` (${status.plan_months} month${status.plan_months === 1 ? "" : "s"})` : ""}`}
                  className="text-sm px-4 py-2 rounded-full border transition disabled:opacity-40"
                  style={{ borderColor: active ? "#16232E" : "#E4E2D8", backgroundColor: active ? "#16232E" : "white", color: active ? "white" : "#4B5563" }}>
                  {m === 1 ? "Monthly" : `${m} months`}
                  {d > 0 && <span className="ml-2 text-xs" style={{ color: active ? "#D9A441" : "#1F6B4A" }}>save {d}%</span>}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const q = quotes[plan.id];
              const price = q ? q.out_price : null;
              const credit = q ? q.out_credit : 0;
              const pay = q ? q.out_amount : null;
              const ok = q ? q.out_ok : false;
              const save = price != null ? plan.monthly_price * months - price : 0;
              const perMonth = price != null ? Math.floor(price / months) : 0;
              const sameTier = !renew && running && status.plan_id === plan.id;
              // "Current" marks the one tier-and-length combination they are actually on.
              // (A plan set by hand has no recorded length, so only then is the tier marked on every tab.)
              const isCurrent = sameTier && (status.plan_months == null || status.plan_months === months);
              const reasonText = sameTier
                ? (isCurrent ? "This is your current plan. It can be renewed once it ends." : "You're already on this plan. Its length can be changed once it ends.")
                : q?.out_reason;
              const disabled = !isOwner || !ok;
              const label = renew ? "Renew" : !running ? "Choose plan" : "Upgrade now";
              return (
                <div key={plan.id} className="bg-white rounded-xl border p-5 flex flex-col" style={{ borderColor: isCurrent ? "#D9A441" : "#E4E2D8" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm" style={{ color: "#16232E" }}>{plan.name}</h3>
                    {isCurrent && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#D9A44120", color: "#8A5D00" }}>Current · {inGrace ? "expired" : `until ${dateFmt(runningEnd)}`}</span>}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#6B7280" }}>
                    {plan.doc_limit == null ? "Unlimited documents" : `Up to ${plan.doc_limit} documents`}
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-semibold" style={{ color: "#16232E" }}>{price != null ? rupees(price) : "…"}</span>
                    <span className="text-xs ml-1" style={{ color: "#6B7280" }}>{months === 1 ? "/ month" : `for ${months} months`}</span>
                  </div>
                  <div className="text-xs mt-1 min-h-[2rem]" style={{ color: "#1F6B4A" }}>
                    {months > 1 && save > 0 ? `${rupees(perMonth)}/month · you save ${rupees(save)}` : ""}
                  </div>
                  {ok && credit > 0 && (
                    <div className="text-xs mt-1" style={{ color: "#4B5563" }}>
                      Less credit for unused days: −{rupees(credit)}
                      <div className="text-sm font-medium mt-0.5" style={{ color: "#16232E" }}>You pay {rupees(pay)}</div>
                    </div>
                  )}
                  {q && !ok && (
                    <div className="text-xs mt-2" style={{ color: "#6B7280" }}>{reasonText}</div>
                  )}
                  {q && ok && q.out_docs_over > 0 && (
                    <div className="text-xs mt-2 flex items-start gap-1" style={{ color: "#B5750A" }}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {renew ? `You have ${status?.docs_used} documents and this plan allows ${plan.doc_limit}. When it starts, your account stays locked until you delete ${q.out_docs_over}, so deleting before then avoids any lock. While locked, you can only view names and delete.` : `You have ${status?.docs_used} documents and this plan allows ${plan.doc_limit}. Your account stays locked until you delete ${q.out_docs_over}. While locked, you can only view names and delete.`}
                    </div>
                  )}
                  <button disabled={disabled} onClick={() => { setError(""); setConfirm({ plan, quote: q }); }}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40"
                    style={{ backgroundColor: "#16232E", color: "white", marginTop: "1rem" }}>
                    {label}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            Plans are priced by the number of documents you track — each dated item, such as one licence or certificate, counts as one. All prices are in rupees.
          </p>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>{renew ? "Confirm your renewal" : "Confirm your plan"}</h3>
              <button onClick={() => setConfirm(null)}><X size={18} color="#9CA3AF" /></button>
            </div>
            <div className="text-sm space-y-1.5 mb-4" style={{ color: "#4B5563" }}>
              <div className="flex justify-between"><span>Plan</span><span style={{ color: "#16232E" }}>{confirm.plan.name} ({confirm.plan.doc_limit == null ? "unlimited documents" : `up to ${confirm.plan.doc_limit}`})</span></div>
              <div className="flex justify-between"><span>Length</span><span style={{ color: "#16232E" }}>{months === 1 ? "1 month" : `${months} months`}</span></div>
              {renew
                ? <div className="flex justify-between"><span>Starts</span><span style={{ color: "#16232E" }}>When your current plan ends</span></div>
                : <div className="flex justify-between"><span>Runs until</span><span style={{ color: "#16232E" }}>{dateFmt(addMonths(months))}</span></div>}
              <div className="flex justify-between"><span>Price</span><span style={{ color: "#16232E" }}>{rupees(confirm.quote.out_price)}</span></div>
              {confirm.quote.out_credit > 0 && (
                <div className="flex justify-between"><span>Credit for unused days</span><span style={{ color: "#16232E" }}>−{rupees(confirm.quote.out_credit)}</span></div>
              )}
              <div className="flex justify-between font-medium"><span>You pay</span><span style={{ color: "#16232E" }}>{rupees(confirm.quote.out_amount)}</span></div>
            </div>
            {confirm.quote.out_docs_over > 0 && (
              <p className="text-xs mb-3" style={{ color: "#B5750A" }}>
                {renew ? `You have more documents than this plan allows. When it starts, your account stays locked until you delete ${confirm.quote.out_docs_over}, and you can only view names and delete. Deleting before then avoids any lock.` : `You have more documents than this plan allows. Until you delete ${confirm.quote.out_docs_over}, your account stays locked and you can only view names and delete. Your plan still starts on payment.`}
              </p>
            )}
            {months > 1 && (
              <p className="text-xs mb-3" style={{ color: "#6B7280" }}>6- and 12-month plans are prepaid and non-refundable.</p>
            )}
            <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
              {renew
                ? "Your renewal is set up once we confirm your payment, and starts automatically when your current plan ends."
                : paymentLink
                  ? "You'll get a link to the payment page. Your plan starts once we confirm your payment."
                  : `We'll contact you at ${email} with payment details. Your plan starts once we confirm your payment.`}
            </p>
            {error && <p className="text-xs mb-3" style={{ color: "#B3261E" }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button disabled={submitting} onClick={submit} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
                {submitting ? "Sending…" : "Confirm request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
