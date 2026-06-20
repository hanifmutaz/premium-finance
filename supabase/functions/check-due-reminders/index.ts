// Supabase Edge Function: check-due-reminders
// Runs on a schedule (cron) to check upcoming debt due dates and send push notifications
// Deploy: supabase functions deploy check-due-reminders
// Schedule via Supabase Dashboard -> Edge Functions -> Cron (e.g. daily at 08:00)

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@noxomor.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date();
  const in7days = new Date(today);
  in7days.setDate(in7days.getDate() + 7);

  // ── 1. Find debts due within 7 days ──────────────────────────────────────
  // Catatan: untuk cicilan (is_installment), tanggal jatuh tempo yang relevan
  // adalah next_due_date, bukan due_date (yang itu tanggal jatuh tempo akhir).
  const { data: debts, error: debtsError } = await supabase
    .from("debts")
    .select("id, user_id, name, due_date, next_due_date, is_installment, remaining")
    .eq("status", "active");

  if (debtsError) {
    return new Response(JSON.stringify({ error: debtsError.message }), { status: 500 });
  }

  const dueSoonDebts = (debts ?? []).filter((debt) => {
    const dueStr = debt.is_installment && debt.next_due_date ? debt.next_due_date : debt.due_date;
    if (!dueStr) return false;
    const due = new Date(dueStr);
    return due >= today && due <= in7days;
  });

  let notificationsSent = 0;
  const errors: string[] = [];

  for (const debt of dueSoonDebts) {
    const dueStr = debt.is_installment && debt.next_due_date ? debt.next_due_date : debt.due_date;

    // Check if notification already sent today for this debt
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("reference_id", debt.id)
      .eq("type", "debt_due")
      .gte("created_at", today.toISOString().split("T")[0])
      .limit(1);

    if (existing && existing.length > 0) continue; // already notified today

    const daysLeft = Math.ceil(
      (new Date(dueStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const title = "Jatuh Tempo Utang";
    const message = `${debt.name} jatuh tempo ${daysLeft <= 0 ? "hari ini" : `dalam ${daysLeft} hari`}. Sisa: Rp ${Number(debt.remaining).toLocaleString("id-ID")}`;

    // Insert in-app notification
    await supabase.from("notifications").insert({
      user_id: debt.user_id,
      type: "debt_due",
      title,
      message,
      reference_id: debt.id,
      reference_type: "debt",
    });

    // Get user's push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", debt.user_id);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title,
            body: message,
            url: "/debts",
            tag: `debt-${debt.id}`,
          })
        );
        notificationsSent++;
      } catch (err) {
        // Remove invalid/expired subscriptions
        if (err instanceof Error && (err.message.includes("410") || err.message.includes("404"))) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        errors.push(`Failed to send to ${sub.endpoint}: ${err}`);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      debtsChecked: dueSoonDebts.length,
      notificationsSent,
      errors,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});