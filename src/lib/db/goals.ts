import { getSupabaseUser } from "./client";
import type { Goal } from "@/types";

// ─── Goals ────────────────────────────────────────────────────────────────────
export async function getGoals() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .order("deadline", { ascending: true });
    if (error) throw error;
    return data as Goal[];
}

export async function addGoal(goal: {
    name: string; target_amount: number; deadline: string;
    priority: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("goals")
        .insert({ ...goal, user_id: userId, current_amount: 0, status: "active" })
        .select()
        .single();
    if (error) throw error;
    return data as Goal;
}

export async function updateGoalAmount(id: string, amount: number) {
    const { supabase } = await getSupabaseUser();

    // Auto-tandai "completed" kalau tabungan udah nyampe/lewat target.
    const { data: existing } = await supabase.from("goals").select("target_amount").eq("id", id).single();
    const payload: Record<string, unknown> = { current_amount: amount, updated_at: new Date().toISOString() };
    if (existing && amount >= Number(existing.target_amount)) payload.status = "completed";

    const { data, error } = await supabase
        .from("goals")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Goal;
}

export async function updateGoal(id: string, goal: {
    name: string; target_amount: number; deadline: string;
    priority: string; notes?: string;
}) {
    const { supabase } = await getSupabaseUser();

    // Samain status "completed" ulang terhadap target_amount BARU — kalau
    // gak, goal yang udah "completed" bisa nyangkut status-nya pas
    // target_amount dinaikin (jadi belum lunas beneran), atau sebaliknya
    // tetep "active" padahal target diturunin di bawah tabungan yang udah
    // kekumpul. Sama logic-nya kayak di updateGoalAmount().
    const { data: existing } = await supabase.from("goals").select("current_amount, status").eq("id", id).single();
    const status =
        existing && (existing.status === "active" || existing.status === "completed")
            ? (Number(existing.current_amount) >= Number(goal.target_amount) ? "completed" : "active")
            : undefined;

    const { data, error } = await supabase
        .from("goals")
        .update({ ...goal, ...(status ? { status } : {}), updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Goal;
}

export async function deleteGoal(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
}