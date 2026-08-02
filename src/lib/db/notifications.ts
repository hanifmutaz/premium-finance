import { getSupabaseUser } from "./client";
import type { Notification } from "@/types";

// ─── Notifications ──────────────────────────────────────────────────────────
// ─── Notification Preferences ──────────────────────────────────────────────
export interface NotificationPreferences {
    debt_due: boolean;
    goal_reminder: boolean;
    recurring_bill: boolean;
    wishlist_update: boolean;
    health_score_weekly: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
    debt_due: true,
    goal_reminder: true,
    recurring_bill: false,
    wishlist_update: false,
    health_score_weekly: true,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", userId)
        .single();
    if (error) throw error;
    return { ...DEFAULT_NOTIF_PREFS, ...(data?.notification_preferences ?? {}) };
}

export async function updateNotificationPreferences(prefs: Partial<NotificationPreferences>) {
    const { supabase, userId } = await getSupabaseUser();
    const current = await getNotificationPreferences();
    const updated = { ...current, ...prefs };

    const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: updated })
        .eq("id", userId);
    if (error) throw error;
    return updated;
}

export async function getNotifications(): Promise<Notification[]> {
    const { supabase, userId } = await getSupabaseUser();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const [{ data: stored, error: storedError }, { data: debts, error: debtsError }, prefs] = await Promise.all([
        supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
        supabase
            .from("debts")
            .select("id, name, due_date, next_due_date, is_installment, remaining")
            .eq("user_id", userId)
            .eq("status", "active"),
        getNotificationPreferences(),
    ]);
    if (storedError) throw storedError;
    if (debtsError) throw debtsError;

    // User matiin toggle "Jatuh tempo utang" — jangan tampilin debt_due sama
    // sekali, baik yang udah persisted (dari cron) maupun yang live-generated.
    const debtDueEnabled = prefs.debt_due;

    const storedNotifs = ((stored ?? []) as Notification[])
        .filter((n) => debtDueEnabled || n.type !== "debt_due");

    // Kalau cron sudah pernah insert notif debt_due untuk debt ini hari ini,
    // jangan tampilkan versi "live" lagi biar gak dobel.
    const alreadyNotifiedToday = new Set(
        storedNotifs
            .filter((n) => n.type === "debt_due" && n.reference_id && new Date(n.created_at) >= today)
            .map((n) => n.reference_id)
    );

    const liveNotifs: Notification[] = !debtDueEnabled ? [] : (debts ?? [])
        .map((d): Notification | null => {
            const dueStr = d.is_installment && d.next_due_date ? d.next_due_date : d.due_date;
            if (!dueStr || alreadyNotifiedToday.has(d.id)) return null;

            const due = new Date(dueStr);
            if (due > in7Days) return null;

            const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const whenText =
                daysLeft < 0 ? `terlambat ${Math.abs(daysLeft)} hari`
                    : daysLeft === 0 ? "jatuh tempo hari ini"
                        : `jatuh tempo dalam ${daysLeft} hari`;

            return {
                id: `live-debt-${d.id}`,
                user_id: userId,
                type: "debt_due",
                title: "Jatuh Tempo Utang",
                message: `${d.name} ${whenText}. Sisa Rp ${Number(d.remaining).toLocaleString("id-ID")}.`,
                is_read: false,
                reference_id: d.id,
                reference_type: "debt",
                created_at: new Date().toISOString(),
            };
        })
        .filter((n): n is Notification => n !== null);

    return [...liveNotifs, ...storedNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export async function markNotificationRead(id: string) {
    // Notif "live" (id-nya "live-debt-...") gak ada row-nya di DB, jadi gak perlu di-update.
    if (id.startsWith("live-debt-")) return;
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) throw error;
}

export async function markAllNotificationsRead() {
    const { supabase, userId } = await getSupabaseUser();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    if (error) throw error;
}

// Live-listen utk row baru di tabel `notifications` (butuh realtime
// di-enable di Supabase: `alter publication supabase_realtime add table public.notifications;`).
// Return fungsi untuk unsubscribe — wajib dipanggil di cleanup useEffect.
export async function subscribeToNotifications(
    onInsert: (notif: Notification) => void
): Promise<() => void> {
    const { supabase, userId } = await getSupabaseUser();

    const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            (payload) => onInsert(payload.new as Notification)
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

