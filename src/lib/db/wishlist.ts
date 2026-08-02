import { getSupabaseUser } from "./client";
import type { Wishlist } from "@/types";

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export async function getWishlist() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("wishlists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Wishlist[];
}

export async function addWishlistItem(item: {
    name: string; category: string; price: number;
    priority: string; target_date?: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("wishlists")
        .insert({ ...item, user_id: userId, saved_amount: 0, status: "pending" })
        .select()
        .single();
    if (error) throw error;
    return data as Wishlist;
}

// ─── Savings Overview ("Tabungan") ─────────────────────────────────────────
// Gabungan progress dari Goals (target aktif) + Wishlist (item pending) —
// representasi "total udah nabung berapa, dari target berapa" buat dashboard.
export interface SavingsOverviewItem {
    id: string;
    name: string;
    type: "goal" | "wishlist";
    saved: number;
    target: number;
}
export interface SavingsOverview {
    totalSaved: number;
    totalTarget: number;
    items: SavingsOverviewItem[];
}

export async function getSavingsOverview(): Promise<SavingsOverview> {
    const { supabase, userId } = await getSupabaseUser();

    const [{ data: goals, error: goalsError }, { data: wishlist, error: wishlistError }] = await Promise.all([
        supabase.from("goals").select("id, name, current_amount, target_amount").eq("user_id", userId).eq("status", "active"),
        supabase.from("wishlists").select("id, name, saved_amount, price").eq("user_id", userId).eq("status", "pending"),
    ]);
    if (goalsError) throw goalsError;
    if (wishlistError) throw wishlistError;

    const items: SavingsOverviewItem[] = [
        ...(goals ?? []).map((g) => ({
            id: g.id, name: g.name, type: "goal" as const,
            saved: Number(g.current_amount), target: Number(g.target_amount),
        })),
        ...(wishlist ?? []).map((w) => ({
            id: w.id, name: w.name, type: "wishlist" as const,
            saved: Number(w.saved_amount), target: Number(w.price),
        })),
    ].sort((a, b) => b.saved - a.saved);

    return {
        totalSaved: items.reduce((s, i) => s + i.saved, 0),
        totalTarget: items.reduce((s, i) => s + i.target, 0),
        items,
    };
}

// ─── Cumulative Savings (real, sejak transaksi pertama) ────────────────────
// Sum dari semua transaksi tipe "saving" — uang yang SENGAJA dipindahin ke
// tabungan, bukan sisa/leftover income-expense. Beda sama getSavingsOverview()
// (yang itu rollup dari progress Goals+Wishlist).
export async function getCumulativeSavings(): Promise<number> {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("type", "saving");
    if (error) throw error;

    return (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
}

export async function updateWishlistSaving(id: string, saved_amount: number) {
    const { supabase } = await getSupabaseUser();
    // Catatan: sengaja gak auto-ubah status ke "saved" di sini — halaman /wishlist
    // saat ini cuma punya 2 bucket tampilan (pending vs purchased), jadi kalau status
    // di-flip ke "saved" tanpa halaman-nya nge-handle bucket itu, item bakal hilang
    // dari kedua daftar. "Tandai sudah dibeli" tetap manual lewat alur yang sudah ada.
    const { data, error } = await supabase
        .from("wishlists")
        .update({ saved_amount, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Wishlist;
}

export async function updateWishlistItem(id: string, item: {
    name: string; category: string; price: number;
    priority: string; target_date?: string; notes?: string;
}) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("wishlists")
        .update({ ...item, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Wishlist;
}

export async function deleteWishlistItem(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("wishlists").delete().eq("id", id);
    if (error) throw error;
}

