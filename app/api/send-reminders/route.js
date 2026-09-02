import { createClient } from "@supabase/supabase-js";

// This route runs server-side only, once a day, triggered by Vercel Cron (see vercel.json).
// It uses the SERVICE ROLE key — not the public anon key — because it needs to read
// across every organization's documents, which normal RLS policies deliberately block.
//
// The client is created INSIDE the handler (not at module load time) so the app can still
// build and deploy even before SUPABASE_SERVICE_ROLE_KEY is configured in Vercel — reminders
// simply won't send until that env variable is added, but nothing else breaks in the meantime.

const THRESHOLDS = [90, 60, 45, 30, 15, 7, 1];

export async function GET(request) {
  // Basic protection so this endpoint can't be triggered by randoms hitting the URL
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

  // Pull every document that has an expiry date, along with its full path
  // (org > type > record > category) so the email can say exactly what's expiring and where.
  const { data: docs, error } = await supabaseAdmin
    .from("documents")
    .select(`
      id, name, expiry_date, org_id,
      document_categories ( name, records ( name, record_types ( name ) ) )
    `)
    .not("expiry_date", "is", null);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Group documents that need a reminder today, by organization
  const byOrg = {};
  for (const doc of docs) {
    const expiry = new Date(doc.expiry_date);
    const daysLeft = Math.round((expiry - today) / 86400000);
    const threshold = THRESHOLDS.find((t) => t === daysLeft);
    if (threshold === undefined) continue;

    // Check we haven't already sent this exact document+threshold combination before
    const { data: already } = await supabaseAdmin
      .from("sent_reminders")
      .select("id")
      .eq("document_id", doc.id)
      .eq("threshold_days", threshold)
      .maybeSingle();
    if (already) continue;

    if (!byOrg[doc.org_id]) byOrg[doc.org_id] = [];
    byOrg[doc.org_id].push({ ...doc, daysLeft, threshold });
  }

  let emailsSent = 0;

  for (const orgId of Object.keys(byOrg)) {
    const { data: recipients } = await supabaseAdmin
      .from("reminder_emails")
      .select("email")
      .eq("org_id", orgId);

    if (!recipients || recipients.length === 0) continue; // no recipients configured, skip

    const items = byOrg[orgId];
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
        <p style="color:#6B7280;">The following ${items.length} document${items.length !== 1 ? "s" : ""} on your Meyaad account ${items.length !== 1 ? "are" : "is"} approaching expiry:</p>
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

    // Log every document+threshold as sent, so tomorrow's run doesn't repeat it
    for (const d of items) {
      await supabaseAdmin.from("sent_reminders").insert({ document_id: d.id, threshold_days: d.threshold });
    }
  }

  return Response.json({ ok: true, orgsNotified: Object.keys(byOrg).length, emailsSent });
}
