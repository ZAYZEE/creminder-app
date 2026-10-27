"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";
import { Check, X, AlertTriangle } from "lucide-react";

const PERIODS = [1, 6, 12];
const rupees = (n) => "₹" + Number(n).toLocaleString("en-IN");

export default function Upgrade() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState({});
  const [status, setStatus] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(null);
  const [months, setMonths] = useState(12);
  const [confirm, setConfirm] = useState(null); // the plan being confirmed
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
    setEmail(session.user.email);
    const [p, s, st, member, pend] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("app_settings").select("key, value, text_value"),
      supabase.rpc("get_org_status"),
      supabase.from("org_members").select("role").eq("user_id", session.user.id).single(),
      supabase.from("upgrade_requests").select("plan_id, months, amount, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(1),
    ]);
    setPlans(p.data || []);
    const map = {};
    (s.data || []).forEach((r) => { map[r.key] = r; });
    setSettings(map);
    if (st.data && st.data[0]) setStatus(st.data[0]);
    setIsOwner(member.data?.role === "owner");
    setPending(pend.data && pend.data[0] ? pend.data[0] : null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const discountFor = (m) =>
    m === 6 ? Number(settings.prepay_discount_6_months?.value || 0)
    : m === 12 ? Number(settings.prepay_discount_12_months?.value || 0)
    : 0;
  const totalFor = (plan, m) => Math.round((plan.monthly_price * m * (100 - discountFor(m))) / 100);
  const paymentLink = settings.payment_link_url?.text_value || "";
  const planName = (id) => plans.find((p) => p.id === id)?.name || "";

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const { data, error: err } = await supabase.rpc("request_plan", { p_plan_id: confirm.id, p_months: months });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    const row = data && data[0];
    setDone({ name: row?.out_plan_name || confirm.name, months, amount: row?.out_amount ?? totalFor(confirm, months) });
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

          {done && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#E7F3ED", color: "#1F6B4A" }}>
              <div className="font-medium">Request received: {done.name} plan, {done.months === 1 ? "1 month" : `${done.months} months`} — {rupees(done.amount)}</div>
              <div className="mt-0.5">
                {paymentLink
                  ? "Complete your payment on the payment page. Your plan starts once we confirm it."
                  : `We'll contact you at ${email} with payment details. Your plan starts once we confirm your payment.`}
              </div>
              {paymentLink && (
                <a href={paymentLink} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#16232E", color: "white" }}>
                  Open payment page
                </a>
              )}
            </div>
          )}

          {!done && pending && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "#FAF6E0", color: "#8A6D00" }}>
              <div className="font-medium">Open request: {planName(pending.plan_id)} plan, {pending.months === 1 ? "1 month" : `${pending.months} months`} — {rupees(pending.amount)}</div>
              <div className="mt-0.5">Waiting for payment confirmation. Choosing a different plan below replaces this request.</div>
              {paymentLink && (
                <a href={paymentLink} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#16232E", color: "white" }}>
                  Open payment page
                </a>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {PERIODS.map((m) => {
              const d = discountFor(m);
              const active = months === m;
              return (
                <button key={m} onClick={() => setMonths(m)} className="text-sm px-4 py-2 rounded-full border transition"
                  style={{ borderColor: active ? "#16232E" : "#E4E2D8", backgroundColor: active ? "#16232E" : "white", color: active ? "white" : "#4B5563" }}>
                  {m === 1 ? "Monthly" : `${m} months`}
                  {d > 0 && <span className="ml-2 text-xs" style={{ color: active ? "#D9A441" : "#1F6B4A" }}>save {d}%</span>}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const total = totalFor(plan, months);
              const full = plan.monthly_price * months;
              const save = full - total;
              const perMonth = Math.round(total / months);
              const tooMany = plan.doc_limit != null && status && status.docs_used > plan.doc_limit;
              const isCurrent = status?.plan_active && status.plan_id === plan.id;
              const disabled = !isOwner || tooMany;
              return (
                <div key={plan.id} className="bg-white rounded-xl border p-5 flex flex-col" style={{ borderColor: isCurrent ? "#D9A441" : "#E4E2D8" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm" style={{ color: "#16232E" }}>{plan.name}</h3>
                    {isCurrent && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#D9A44120", color: "#8A5D00" }}>Current</span>}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#6B7280" }}>
                    {plan.doc_limit == null ? "Unlimited documents" : `Up to ${plan.doc_limit} documents`}
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-semibold" style={{ color: "#16232E" }}>{rupees(total)}</span>
                    <span className="text-xs ml-1" style={{ color: "#6B7280" }}>{months === 1 ? "/ month" : `for ${months} months`}</span>
                  </div>
                  <div className="text-xs mt-1 min-h-[2rem]" style={{ color: "#1F6B4A" }}>
                    {months > 1 && save > 0 ? `${rupees(perMonth)}/month · you save ${rupees(save)}` : ""}
                  </div>
                  {tooMany && (
                    <div className="text-xs mt-2 flex items-start gap-1" style={{ color: "#B3261E" }}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      You have {status.docs_used} documents, more than this plan allows.
                    </div>
                  )}
                  <button disabled={disabled} onClick={() => { setError(""); setConfirm(plan); }}
                    className="mt-auto pt-0 w-full py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40"
                    style={{ backgroundColor: "#16232E", color: "white", marginTop: "1rem" }}>
                    {isCurrent ? "Renew" : "Choose plan"}
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
              <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Confirm your plan</h3>
              <button onClick={() => setConfirm(null)}><X size={18} color="#9CA3AF" /></button>
            </div>
            <div className="text-sm space-y-1.5 mb-4" style={{ color: "#4B5563" }}>
              <div className="flex justify-between"><span>Plan</span><span style={{ color: "#16232E" }}>{confirm.name} ({confirm.doc_limit == null ? "unlimited documents" : `up to ${confirm.doc_limit}`})</span></div>
              <div className="flex justify-between"><span>Length</span><span style={{ color: "#16232E" }}>{months === 1 ? "1 month" : `${months} months`}</span></div>
              <div className="flex justify-between"><span>Total</span><span className="font-medium" style={{ color: "#16232E" }}>{rupees(totalFor(confirm, months))}</span></div>
            </div>
            {months > 1 && (
              <p className="text-xs mb-3" style={{ color: "#6B7280" }}>6- and 12-month plans are prepaid and non-refundable.</p>
            )}
            <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
              {paymentLink
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
