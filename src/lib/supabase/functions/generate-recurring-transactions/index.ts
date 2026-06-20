// Supabase Edge Function: generate-recurring-transactions
// Runs daily via cron. Checks all active recurring templates and, if today
// matches their schedule and hasn't been generated yet, inserts a real
// transaction row + updates last_generated_date to prevent duplicates.
// Deploy: supabase functions deploy generate-recurring-transactions
// Schedule via Supabase Dashboard -> Edge Functions -> Cron (e.g. daily at 06:00)

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (_req) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dayOfMonth = today.getDate();
    const dayOfWeek = today.getDay(); // 0=Sunday

    // Last day of current month, to handle templates set on day 29/30/31
    // for months that don't have that many days (e.g. Feb).
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const { data: templates, error } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("is_active", true)
        .lte("start_date", todayStr)
        .or(`end_date.is.null,end_date.gte.${todayStr}`);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    let generated = 0;
    const errors: string[] = [];

    for (const tpl of templates ?? []) {
        // Skip if already generated today (prevents duplicate runs on retry)
        if (tpl.last_generated_date === todayStr) continue;

        let isDue = false;
        if (tpl.frequency === "monthly") {
            // If day_of_period exceeds days in this month (e.g. 31 in Feb), treat
            // the last day of the month as the due date instead.
            const effectiveDay = Math.min(tpl.day_of_period, lastDayOfMonth);
            isDue = dayOfMonth === effectiveDay;
        } else if (tpl.frequency === "weekly") {
            isDue = dayOfWeek === tpl.day_of_period;
        }

        if (!isDue) continue;

        try {
            const { error: txError } = await supabase.from("transactions").insert({
                user_id: tpl.user_id,
                type: tpl.type,
                name: tpl.name,
                description: tpl.notes ?? `Otomatis dari template berulang`,
                category_id: tpl.category_id,
                amount: tpl.amount,
                date: todayStr,
                payment_method: tpl.payment_method,
                status: "completed",
                recurring_id: tpl.id,
            });

            if (txError) {
                errors.push(`Failed for template ${tpl.id} (${tpl.name}): ${txError.message}`);
                continue;
            }

            await supabase
                .from("recurring_transactions")
                .update({ last_generated_date: todayStr })
                .eq("id", tpl.id);

            generated++;
        } catch (err) {
            errors.push(`Exception for template ${tpl.id}: ${err}`);
        }
    }

    return new Response(
        JSON.stringify({
            success: true,
            templatesChecked: templates?.length ?? 0,
            generated,
            errors,
        }),
        { headers: { "Content-Type": "application/json" } }
    );
});