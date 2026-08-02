import { createClient } from "@/lib/supabase/client";

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Dipakai di semua modul db/* — 1 tempat buat ambil supabase client + userId
// yang lagi login. Kalau nggak ada session aktif, langsung throw (caller di
// komponen/page yang nangkep lewat try/catch + toast).
export async function getSupabaseUser() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated");
    return { supabase, userId: session.user.id };
}
