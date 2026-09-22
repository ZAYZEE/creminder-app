import { createClient } from "@supabase/supabase-js";

// This route runs server-side only, once a day, triggered by Vercel Cron (see vercel.json).
// It uses the SERVICE ROLE key — not the public anon key — because it needs to read
// across every organization's documents, which normal RLS policies deliberately block.
//
// The client is created INSIDE the handler (not at module load time) so the app can still
// build and deploy even before SUPABASE_SERVICE_ROLE_KEY is configured in Vercel — reminders
// simply won't send until that env variable is added, but nothing else breaks in the meantime.
//
// Recipients are per DOCUMENT CATEGORY (not one flat org-wide list) — each category can
// notify a different set of people, since different categories of paperwork are often
// owned by different roles even within the same record.

const THRESHOLDS = [90, 60, 45, 30, 15, 7, 1];

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) {
    return Response.json({ skipped: true, reason: "Reminder env variables not configured yet — see DEPLOYMENT_GUIDE.md section 8." });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: docs, error } = await supabaseAdmin
    .from("documents")
    .select(`
      id, name, expiry_date, category_id, org_id,
      document_categories ( name, records ( name, record_types ( name ) ) )
    `)
    .not("expiry_date", "is", null);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Skip documents belonging to organizations whose trial has ended and haven't upgraded —
  // reminders are part of the paid value, not something that should keep working for free
  // indefinitely just because someone finished adding their documents during the trial.
  const orgIds = [...new Set(docs.map((d) => d.org_id))];
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id, trial_started_at, trial_length_days, is_upgraded")
    .in("id", orgIds);
  const activeOrgIds = new Set(
    (orgs || [])
      .filter((o) => o.is_upgraded || (Date.now() - new Date(o.trial_started_at)) < o.trial_length_days * 86400000)
      .map((o) => o.id)
  );
  const activeDocs = docs.filter((d) => activeOrgIds.has(d.org_id));

  // Group documents that need a reminder today, by CATEGORY (not by org)
  const byCategory = {};
  for (const doc of activeDocs) {
    const expiry = new Date(doc.expiry_date);
    const daysLeft = Math.round((expiry - today) / 86400000);
    const threshold = THRESHOLDS.find((t) => t === daysLeft);
    if (threshold === undefined) continue;

    const { data: already } = await supabaseAdmin
      .from("sent_reminders")
      .select("id")
      .eq("document_id", doc.id)
      .eq("threshold_days", threshold)
      .maybeSingle();
    if (already) continue;

    if (!byCategory[doc.category_id]) byCategory[doc.category_id] = [];
    byCategory[doc.category_id].push({ ...doc, daysLeft, threshold });
  }

  let emailsSent = 0;

  for (const categoryId of Object.keys(byCategory)) {
    const { data: recipients } = await supabaseAdmin
      .from("category_recipients")
      .select("email")
      .eq("category_id", categoryId);

    if (!recipients || recipients.length === 0) continue; // no recipients configured for this category, skip

    const items = byCategory[categoryId];
    const rows = items
      .map((d) => {
        const path = `${d.document_categories?.records?.record_types?.name || ""} → ${d.document_categories?.records?.name || ""} → ${d.document_categories?.name || ""}`;
        const label = d.daysLeft <= 0 ? "expires today" : `expires in ${d.daysLeft} day${d.daysLeft !== 1 ? "s" : ""}`;
        return `<tr><td style="padding:8px 12px;border-bottom:1px solid #E4E2D8;">${d.name}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E2D8;color:#6B7280;font-size:13px;">${path}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E2D8;color:#B5750A;font-weight:600;">${label}</td></tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#16232E;">Documents needing attention</h2>
        <p style="color:#6B7280;">The following ${items.length} document${items.length !== 1 ? "s" : ""} ${items.length !== 1 ? "are" : "is"} approaching expiry:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead><tr style="text-align:left;background:#FAFAF7;"><th style="padding:8px 12px;">Document</th><th style="padding:8px 12px;">Where</th><th style="padding:8px 12px;">Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    for (const r of recipients) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Meyaad Reminders <reminders@yourdomain.com>", // replace with your verified Resend sending domain
          to: r.email,
          subject: `${items.length} document${items.length !== 1 ? "s" : ""} expiring soon`,
          html,
        }),
      });
      emailsSent++;
    }

    for (const d of items) {
      await supabaseAdmin.from("sent_reminders").insert({ document_id: d.id, threshold_days: d.threshold });
    }
  }

  return Response.json({ ok: true, categoriesNotified: Object.keys(byCategory).length, emailsSent });
}
