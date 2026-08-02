import { getSupabaseUser } from "./client";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";

// ─── Seed default categories ──────────────────────────────────────────────────
export async function seedDefaultCategories(userId: string) {
    const supabase = createClient();
    const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

    if (existing && existing.length > 0) return;

    const defaults = [
        { name: "Gaji", type: "income" },
        { name: "Freelance", type: "income" },
        { name: "Bonus", type: "income" },
        { name: "THR", type: "income" },
        { name: "Investasi", type: "income" },
        { name: "Lainnya", type: "income" },
        { name: "Makan", type: "expense" },
        { name: "Transport", type: "expense" },
        { name: "Tagihan", type: "expense" },
        { name: "Keluarga", type: "expense" },
        { name: "Belanja", type: "expense" },
        { name: "Kesehatan", type: "expense" },
        { name: "Hiburan", type: "expense" },
        { name: "Investasi Diri", type: "expense" },
        { name: "Lainnya", type: "expense" },
    ];

    await supabase.from("categories").insert(
        defaults.map((c) => ({ ...c, user_id: userId }))
    );
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function getCategories(type?: "income" | "expense") {
    const { supabase, userId } = await getSupabaseUser();
    await seedDefaultCategories(userId);

    let query = supabase.from("categories").select("*").eq("user_id", userId);
    if (type) query = query.eq("type", type);

    const { data, error } = await query.order("name");
    if (error) throw error;
    return data ?? [];
}

export async function addCategory(category: { name: string; type: "income" | "expense"; color?: string }) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("categories")
        .insert({ ...category, user_id: userId })
        .select()
        .single();
    if (error) throw error;
    return data as Category;
}

export async function updateCategory(id: string, category: { name: string; color?: string }) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("categories")
        .update(category)
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Category;
}

export async function deleteCategory(id: string) {
    const { supabase } = await getSupabaseUser();
    // Transaksi yang masih pakai kategori ini akan otomatis jadi "Lainnya" (NULL)
    // begitu kategorinya dihapus — bukan ikut terhapus.
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
}
