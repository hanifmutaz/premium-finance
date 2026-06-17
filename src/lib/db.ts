import { createClient } from "@/lib/supabase/client";
import type { Transaction, Debt, Goal, Wishlist } from "@/types";

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getSupabaseUser() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return { supabase, userId: session.user.id };
}

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

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function getTransactions(filters?: { type?: string; search?: string; limit?: number }) {
  const { supabase, userId } = await getSupabaseUser();
  let query = supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.type && filters.type !== "all") query = query.eq("type", filters.type);
  if (filters?.search) query = query.ilike("name", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as Transaction[];
}

export async function addTransaction(tx: Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at" | "category">) {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...tx, user_id: userId, category_id: tx.category_id || null })
    .select("*, category:categories(*)")
    .single();
  if (error) throw error;

  if (tx.type === "debt_payment" && tx.debt_id) {
    await supabase.from("debt_payments").insert({
      debt_id: tx.debt_id,
      transaction_id: data.id,
      amount: tx.amount,
      date: tx.date,
    });
  }
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  const { supabase } = await getSupabaseUser();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

// ─── Debts ────────────────────────────────────────────────────────────────────
export async function getDebts() {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data as Debt[];
}

export async function addDebt(debt: {
  name: string; lender: string; total_amount: number;
  start_date: string; due_date: string; priority: string; notes?: string;
}) {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("debts")
    .insert({ ...debt, user_id: userId, total_paid: 0, status: "active" })
    .select()
    .single();
  if (error) throw error;
  return data as Debt;
}

export async function deleteDebt(id: string) {
  const { supabase } = await getSupabaseUser();
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
}

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
  const { data, error } = await supabase
    .from("goals")
    .update({ current_amount: amount })
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

export async function updateWishlistSaving(id: string, saved_amount: number) {
  const { supabase } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("wishlists")
    .update({ saved_amount })
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

// ─── Dashboard stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const { supabase, userId } = await getSupabaseUser();

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [txRes, debtRes] = await Promise.all([
    supabase.from("transactions").select("type, amount")
      .eq("user_id", userId).gte("date", firstDay).lte("date", lastDay),
    supabase.from("debts").select("*").eq("user_id", userId).eq("status", "active"),
  ]);

  const transactions = txRes.data ?? [];
  const debts = (debtRes.data ?? []) as Debt[];

  const monthly_income = transactions.filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthly_expense = transactions.filter((t) => t.type !== "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const total_active_debt = debts.reduce((s, d) => s + Number(d.remaining), 0);
  const total_debt_amount = debts.reduce((s, d) => s + Number(d.total_amount), 0);
  const total_debt_paid = debts.reduce((s, d) => s + Number(d.total_paid), 0);
  const nearest_due = [...debts].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )[0] ?? null;

  return {
    monthly_income,
    monthly_expense,
    monthly_remaining: monthly_income - monthly_expense,
    current_balance: monthly_income - monthly_expense,
    total_active_debt,
    debt_paid_percentage: total_debt_amount > 0
      ? Math.round((total_debt_paid / total_debt_amount) * 100) : 0,
    health_score: null,
    nearest_due,
  };
}

// ─── Monthly chart data ───────────────────────────────────────────────────────
export async function getMonthlyChartData() {
  const { supabase, userId } = await getSupabaseUser();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    const monthName = d.toLocaleString("id-ID", { month: "short" });

    const { data } = await supabase.from("transactions").select("type, amount")
      .eq("user_id", userId).gte("date", firstDay).lte("date", lastDay);

    const income = (data ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = (data ?? []).filter((t) => t.type !== "income").reduce((s, t) => s + Number(t.amount), 0);
    months.push({ month: monthName, income, expense, balance: income - expense });
  }
  return months;
}
