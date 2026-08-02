import { getSupabaseUser } from "./client";

// ─── Recurring Transactions ───────────────────────────────────────────────────
export async function getRecurringTransactions() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*, category:categories(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
}

export async function addRecurringTransaction(rec: {
    name: string; type: "income" | "expense"; amount: number;
    category_id?: string; payment_method: string; frequency: "monthly" | "weekly";
    day_of_period: number; start_date: string; end_date?: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("recurring_transactions")
        .insert({ ...rec, user_id: userId, is_active: true })
        .select("*, category:categories(*)")
        .single();
    if (error) throw error;
    return data;
}

export async function updateRecurringTransaction(id: string, rec: {
    name: string; type: "income" | "expense"; amount: number;
    category_id?: string; payment_method: string; frequency: "monthly" | "weekly";
    day_of_period: number; start_date: string; end_date?: string; notes?: string;
}) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("recurring_transactions")
        .update({ ...rec, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, category:categories(*)")
        .single();
    if (error) throw error;
    return data;
}

export async function toggleRecurringActive(id: string, isActive: boolean) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}

export async function deleteRecurringTransaction(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
    if (error) throw error;
}

