import { createClient } from "@/lib/supabase/client";
import type { Transaction, Debt, Goal, Wishlist, Receivable, Notification, Category, Account, AccountType, AccountWithBalance } from "@/types";

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

  // Sync to active budget if this is an expense (or debt payment with a
  // chosen category) that matches a budget category by name.
  if ((tx.type === "expense" || tx.type === "debt_payment") && data.category?.name) {
    await syncBudgetActual(userId, data.category.name, tx.amount, tx.date);
  }

  return data as Transaction;
}

// ─── Accounts (Sumber Dana) ─────────────────────────────────────────────────
export async function getAccounts(): Promise<AccountWithBalance[]> {
  const { supabase, userId } = await getSupabaseUser();

  const [{ data: accounts, error: accError }, { data: txs, error: txError }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("transactions").select("type, amount, account_id, to_account_id").eq("user_id", userId),
  ]);
  if (accError) throw accError;
  if (txError) throw txError;

  // Saldo per akun = saldo_awal + semua transaksi yang nyentuh akun ini.
  // "transfer" itu khusus: ngurangin akun asal (account_id), nambahin akun
  // tujuan (to_account_id). Tipe lain (income/expense/debt_payment/saving)
  // cuma nyentuh satu akun (account_id) — income nambah, sisanya ngurangin.
  return (accounts ?? []).map((acc) => {
    let balance = Number(acc.initial_balance);
    (txs ?? []).forEach((t) => {
      const amt = Number(t.amount);
      if (t.type === "transfer") {
        if (t.account_id === acc.id) balance -= amt;
        if (t.to_account_id === acc.id) balance += amt;
      } else if (t.account_id === acc.id) {
        balance += t.type === "income" ? amt : -amt;
      }
    });
    return { ...acc, balance } as AccountWithBalance;
  });
}

export async function addAccount(account: { name: string; type: AccountType; initial_balance: number; color?: string }) {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("accounts")
    .insert({ ...account, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

export async function updateAccount(id: string, account: { name?: string; type?: AccountType; initial_balance?: number; color?: string }) {
  const { supabase } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("accounts")
    .update({ ...account, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string) {
  const { supabase } = await getSupabaseUser();
  // Transaksi lama yang masih nempel ke akun ini TIDAK ikut terhapus —
  // cuma jadi "tanpa akun" (FK on delete set null).
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function transferBetweenAccounts(params: {
  from_account_id: string; to_account_id: string; amount: number; date: string; notes?: string;
}) {
  const { supabase, userId } = await getSupabaseUser();
  if (params.from_account_id === params.to_account_id) {
    throw new Error("Akun asal dan tujuan gak boleh sama");
  }
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "transfer",
      name: "Transfer Antar Akun",
      description: params.notes || undefined,
      amount: params.amount,
      date: params.date,
      payment_method: "transfer",
      status: "completed",
      account_id: params.from_account_id,
      to_account_id: params.to_account_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

// ─── Budget sync helper ─────────────────────────────────────────────────────
// Finds the active budget covering the transaction date, matches the category
// by name (case-insensitive), and bumps actual_amount + total_actual.
async function syncBudgetActual(userId: string, categoryName: string, amount: number, txDate: string) {
  const supabase = createClient();
  const date = new Date(txDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  const week = Math.ceil(dayOfMonth / 7);

  // Find budgets covering this date: monthly budgets for this year+month,
  // or weekly budgets for this year+month+week.
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id, period, year, month, week")
    .eq("user_id", userId)
    .eq("year", year)
    .or(`and(period.eq.monthly,month.eq.${month}),and(period.eq.weekly,month.eq.${month},week.eq.${week})`);

  if (!budgets || budgets.length === 0) return;

  for (const budget of budgets) {
    const { data: cats } = await supabase
      .from("budget_categories")
      .select("id, name, actual_amount")
      .eq("budget_id", budget.id)
      .ilike("name", categoryName);

    if (!cats || cats.length === 0) continue;

    const cat = cats[0];
    const newActual = Number(cat.actual_amount) + amount;

    await supabase
      .from("budget_categories")
      .update({ actual_amount: newActual })
      .eq("id", cat.id);

    // Recalculate budget total_actual from all its categories
    const { data: allCats } = await supabase
      .from("budget_categories")
      .select("actual_amount")
      .eq("budget_id", budget.id);

    const totalActual = (allCats ?? []).reduce((s, c) => s + Number(c.actual_amount), 0);

    await supabase
      .from("budgets")
      .update({ total_actual: totalActual })
      .eq("id", budget.id);
  }
}

export async function deleteTransaction(id: string) {
  const { supabase, userId } = await getSupabaseUser();

  // Get transaction details before deleting, to reverse budget/debt sync if needed
  const { data: tx } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;

  if (tx && (tx.type === "expense" || tx.type === "debt_payment") && tx.category?.name) {
    await syncBudgetActual(userId, tx.category.name, -Number(tx.amount), tx.date);
  }

  // If this was a debt payment, remove the linked debt_payments row too.
  // The sync_debt_payment trigger will automatically recalculate the debt's
  // total_paid, installments_paid, and next_due_date after this delete.
  if (tx && tx.type === "debt_payment" && tx.debt_id) {
    await supabase.from("debt_payments").delete().eq("transaction_id", id);
  }
}

export async function updateTransaction(
  id: string,
  tx: Partial<Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at" | "category">>
) {
  const { supabase, userId } = await getSupabaseUser();

  // Get original transaction to reverse old budget sync if amount/category/date changes
  const { data: original } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("transactions")
    .update({ ...tx, category_id: tx.category_id || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, category:categories(*)")
    .single();
  if (error) throw error;

  // Reverse old sync, then apply new sync (relevant for expense & debt_payment)
  if (original && (original.type === "expense" || original.type === "debt_payment") && original.category?.name) {
    await syncBudgetActual(userId, original.category.name, -Number(original.amount), original.date);
  }
  if ((data.type === "expense" || data.type === "debt_payment") && data.category?.name) {
    await syncBudgetActual(userId, data.category.name, Number(data.amount), data.date);
  }

  return data as Transaction;
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
  is_installment?: boolean; installment_amount?: number | null; tenor_months?: number | null;
}) {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("debts")
    .insert({
      ...debt,
      user_id: userId,
      total_paid: 0,
      status: "active",
      is_installment: debt.is_installment ?? false,
      installments_paid: 0,
      next_due_date: debt.due_date,
    })
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

export async function updateDebt(id: string, debt: {
  name: string; lender: string; total_amount: number;
  start_date: string; due_date: string; priority: string; notes?: string;
  is_installment?: boolean; installment_amount?: number | null; tenor_months?: number | null;
}) {
  const { supabase } = await getSupabaseUser();

  // If switching to non-installment, clear installment-specific fields
  const installmentClear = debt.is_installment === false
    ? { installments_paid: null, next_due_date: null, installment_amount: null, tenor_months: null }
    : {};

  const { data, error } = await supabase
    .from("debts")
    .update({ ...debt, ...installmentClear, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Debt;
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
  const { data, error } = await supabase
    .from("goals")
    .update({ ...goal, updated_at: new Date().toISOString() })
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

// ─── Dashboard stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const { supabase, userId } = await getSupabaseUser();

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevFirstDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString().split("T")[0];
  const prevLastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split("T")[0];

  const [txRes, prevTxRes, debtRes, recvRes] = await Promise.all([
    supabase.from("transactions").select("type, amount")
      .eq("user_id", userId).gte("date", firstDay).lte("date", lastDay),
    supabase.from("transactions").select("type, amount")
      .eq("user_id", userId).gte("date", prevFirstDay).lte("date", prevLastDay),
    supabase.from("debts").select("*").eq("user_id", userId).eq("status", "active"),
    supabase.from("receivables").select("*").eq("user_id", userId).eq("status", "active"),
  ]);

  const transactions = txRes.data ?? [];
  const prevTransactions = prevTxRes.data ?? [];
  const debts = (debtRes.data ?? []) as Debt[];
  const receivables = recvRes.data ?? [];

  const monthly_income = transactions.filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthly_expense = transactions.filter((t) => t.type !== "income" && t.type !== "transfer")
    .reduce((s, t) => s + Number(t.amount), 0);

  const prev_monthly_income = prevTransactions.filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const prev_monthly_expense = prevTransactions.filter((t) => t.type !== "income" && t.type !== "transfer")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Real percentage change vs last month (null if no prior data to compare against)
  const income_trend = prev_monthly_income > 0
    ? Math.round(((monthly_income - prev_monthly_income) / prev_monthly_income) * 1000) / 10
    : null;
  const expense_trend = prev_monthly_expense > 0
    ? Math.round(((monthly_expense - prev_monthly_expense) / prev_monthly_expense) * 1000) / 10
    : null;

  const total_active_debt = debts.reduce((s, d) => s + Number(d.remaining), 0);
  const total_debt_amount = debts.reduce((s, d) => s + Number(d.total_amount), 0);
  const total_debt_paid = debts.reduce((s, d) => s + Number(d.total_paid), 0);

  // Total piutang aktif (uang yang masih harus diterima dari orang lain)
  const total_active_receivable = receivables.reduce((s, r) => s + Number(r.remaining), 0);

  // Nearest due: untuk cicilan pakai next_due_date, untuk utang biasa pakai due_date
  const nearest_due = [...debts].sort((a, b) => {
    const dateA = a.is_installment && a.next_due_date ? a.next_due_date : a.due_date;
    const dateB = b.is_installment && b.next_due_date ? b.next_due_date : b.due_date;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  })[0] ?? null;

  return {
    monthly_income,
    monthly_expense,
    monthly_remaining: monthly_income - monthly_expense,
    current_balance: monthly_income - monthly_expense,
    income_trend,
    expense_trend,
    total_active_debt,
    total_active_receivable,
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
    const expense = (data ?? []).filter((t) => t.type !== "income" && t.type !== "transfer").reduce((s, t) => s + Number(t.amount), 0);
    months.push({ month: monthName, income, expense, balance: income - expense });
  }
  return months;
}

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

// ─── Forecast defaults from real transaction history ─────────────────────────
// Averages income/expense over the last 3 months so the forecast page can
// start from numbers that reflect actual spending habits, instead of
// hardcoded placeholder values.
export async function getForecastDefaults() {
  const { supabase, userId } = await getSupabaseUser();

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: txs } = await supabase
    .from("transactions")
    .select("type, amount, date")
    .eq("user_id", userId)
    .gte("date", threeMonthsAgo)
    .lte("date", lastDay);

  const transactions = txs ?? [];

  // Group by year-month to average across however many months have data
  const monthKeys = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const monthCount = Math.max(1, monthKeys.size);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalDebtPayment = transactions.filter((t) => t.type === "debt_payment").reduce((s, t) => s + Number(t.amount), 0);

  const avgIncome = Math.round(totalIncome / monthCount);
  const avgExpense = Math.round(totalExpense / monthCount);
  const avgDebtPayment = Math.round(totalDebtPayment / monthCount);

  // Suggest a savings allocation as whatever's left after expenses + debt payment,
  // floored at 0 so we never suggest a negative number.
  const suggestedSavings = Math.max(0, avgIncome - avgExpense - avgDebtPayment);

  return {
    monthly_income: avgIncome,
    fixed_expenses: avgExpense,
    debt_allocation: avgDebtPayment,
    savings_allocation: suggestedSavings,
    hasHistoricalData: transactions.length > 0,
  };
}

// ─── Debt trend (6 months) based on real payment history ─────────────────────
// Walks backward from today's total remaining debt, adding back each month's
// debt_payment transactions, so the trend line reflects actual repayment
// history instead of a flat/fake line.
export async function getDebtTrendData() {
  const { supabase, userId } = await getSupabaseUser();

  const [debtRes, txRes] = await Promise.all([
    supabase.from("debts").select("remaining, status").eq("user_id", userId),
    supabase.from("transactions").select("amount, date")
      .eq("user_id", userId).eq("type", "debt_payment"),
  ]);

  const currentTotalRemaining = (debtRes.data ?? [])
    .filter((d) => d.status === "active")
    .reduce((s, d) => s + Number(d.remaining), 0);

  const payments = txRes.data ?? [];

  const months: { month: string; total: number }[] = [];
  let runningRemaining = currentTotalRemaining;

  // Build last 6 months, starting from current month going backward,
  // then reverse so chart reads left-to-right chronologically.
  const tempMonths: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    tempMonths.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("id-ID", { month: "short" }),
    });
  }

  for (const { key, label } of tempMonths) {
    months.push({ month: label, total: Math.max(0, runningRemaining) });
    // Add back this month's payments to reconstruct what the balance was
    // before this month's payments were made.
    const paidThisMonth = payments
      .filter((p) => p.date.slice(0, 7) === key)
      .reduce((s, p) => s + Number(p.amount), 0);
    runningRemaining += paidThisMonth;
  }

  return months.reverse();
}

// ─── Receivables (Piutang) ────────────────────────────────────────────────────
export async function getReceivables() {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("receivables")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addReceivable(recv: {
  name: string; borrower: string; total_amount: number;
  start_date: string; due_date: string; priority: string; notes?: string;
}) {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("receivables")
    .insert({ ...recv, user_id: userId, total_received: 0, status: "active" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function recordReceivablePayment(receivableId: string, amount: number, notes?: string) {
  const { supabase, userId } = await getSupabaseUser();
  // Get current data
  const { data: recv, error: fetchErr } = await supabase
    .from("receivables")
    .select("*")
    .eq("id", receivableId)
    .single();
  if (fetchErr) throw fetchErr;

  const newReceived = Number(recv.total_received) + amount;
  const newRemaining = Math.max(0, Number(recv.total_amount) - newReceived);
  const newStatus = newRemaining === 0 ? "completed" : recv.status;

  const { data, error } = await supabase
    .from("receivables")
    .update({ total_received: newReceived, status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", receivableId)
    .select()
    .single();
  if (error) throw error;

  const today = new Date().toISOString().split("T")[0];

  // Log payment
  await supabase.from("receivable_payments").insert({
    receivable_id: receivableId,
    amount,
    date: today,
    notes,
  });

  // Auto-create income transaction so dashboard/reports reflect this cash inflow
  await supabase.from("transactions").insert({
    user_id: userId,
    type: "income",
    name: `Piutang Diterima: ${recv.name}`,
    description: notes || `Pembayaran piutang dari ${recv.borrower}`,
    amount,
    date: today,
    payment_method: "transfer",
    status: "completed",
  });

  return data;
}

export async function deleteReceivable(id: string) {
  const { supabase } = await getSupabaseUser();
  const { error } = await supabase.from("receivables").delete().eq("id", id);
  if (error) throw error;
}

export async function updateReceivable(id: string, recv: {
  name: string; borrower: string; total_amount: number;
  start_date: string; due_date: string; priority: string; notes?: string;
}) {
  const { supabase } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("receivables")
    .update({ ...recv, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Receivable;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────
export async function getBudgets() {
  const { supabase, userId } = await getSupabaseUser();
  const { data, error } = await supabase
    .from("budgets")
    .select("*, categories:budget_categories(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addBudget(budget: {
  name: string; period: string; year: number; month?: number; week?: number;
  total_income: number; notes?: string;
  categories: { name: string; planned_amount: number; color?: string }[];
}) {
  const { supabase, userId } = await getSupabaseUser();
  const { categories, ...budgetData } = budget;
  const total_planned = categories.reduce((s, c) => s + c.planned_amount, 0);

  const { data: bud, error } = await supabase
    .from("budgets")
    .insert({ ...budgetData, user_id: userId, total_planned, total_actual: 0 })
    .select()
    .single();
  if (error) throw error;

  if (categories.length > 0) {
    await supabase.from("budget_categories").insert(
      categories.map((c) => ({ ...c, budget_id: bud.id, actual_amount: 0 }))
    );
  }
  return bud;
}

export async function deleteBudget(id: string) {
  const { supabase } = await getSupabaseUser();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}

export async function updateBudget(id: string, budget: {
  name: string; total_income: number; notes?: string;
  categories: { id?: string; name: string; planned_amount: number; actual_amount?: number; color?: string }[];
}) {
  const { supabase } = await getSupabaseUser();
  const { categories, ...budgetData } = budget;
  const total_planned = categories.reduce((s, c) => s + c.planned_amount, 0);
  const total_actual = categories.reduce((s, c) => s + (c.actual_amount ?? 0), 0);

  const { data: bud, error } = await supabase
    .from("budgets")
    .update({ ...budgetData, total_planned, total_actual, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // Replace all categories: delete old, insert new (simplest way to keep things in sync)
  await supabase.from("budget_categories").delete().eq("budget_id", id);
  if (categories.length > 0) {
    await supabase.from("budget_categories").insert(
      categories.map((c) => ({
        name: c.name,
        planned_amount: c.planned_amount,
        actual_amount: c.actual_amount ?? 0,
        color: c.color,
        budget_id: id,
      }))
    );
  }
  return bud;
}

// ─── Notifications ──────────────────────────────────────────────────────────
// Catatan: notif "jatuh tempo utang" idealnya di-generate harian oleh cron job
// (supabase/functions/check-due-reminders) dan disimpan di tabel `notifications`.
// Tapi supaya user tetap lihat alert-nya walau cron belum/belum sempat jalan
// hari itu, di sini kita juga hitung "live alert" langsung dari tabel `debts`
// setiap kali fungsi ini dipanggil, lalu di-merge (dan di-dedupe) dengan yang
// sudah persisted di DB.
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

// ─── Category breakdown (bulan ini, FULL — bukan dari 10 transaksi terakhir) ──
// Dashboard sebelumnya bikin pie chart kategori dari `getTransactions({limit:10})`
// (query yang sebenarnya buat list "Transaksi Terakhir"), jadi misleading kalau
// user punya >10 transaksi sebulan. Ini query langsung semua expense bulan ini.
export async function getCategoryBreakdown(): Promise<{ name: string; value: number }[]> {
  const { supabase, userId } = await getSupabaseUser();

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category:categories(name)")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", firstDay)
    .lte("date", lastDay);
  if (error) throw error;

  const map: Record<string, number> = {};
  ((data ?? []) as any[]).forEach((t) => {
    const cat = t.category?.name ?? "Lainnya";
    map[cat] = (map[cat] ?? 0) + Number(t.amount);
  });

  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

// ─── Global Search ──────────────────────────────────────────────────────────
export interface SearchResult {
  id: string;
  type: "debt" | "transaction" | "goal" | "wishlist" | "receivable" | "account";
  title: string;
  subtitle: string;
  href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { supabase, userId } = await getSupabaseUser();
  const like = `%${q}%`;

  const [debts, transactions, goals, wishlist, receivables, accounts] = await Promise.all([
    supabase.from("debts").select("id, name, lender").eq("user_id", userId).ilike("name", like).limit(5),
    supabase.from("transactions").select("id, name, amount").eq("user_id", userId).ilike("name", like).limit(5),
    supabase.from("goals").select("id, name, target_amount").eq("user_id", userId).ilike("name", like).limit(5),
    supabase.from("wishlists").select("id, name, price").eq("user_id", userId).ilike("name", like).limit(5),
    supabase.from("receivables").select("id, name, borrower, total_amount").eq("user_id", userId).ilike("name", like).limit(5),
    supabase.from("accounts").select("id, name, type, initial_balance").eq("user_id", userId).ilike("name", like).limit(5),
  ]);

  const results: SearchResult[] = [];

  (debts.data ?? []).forEach((d) =>
    results.push({ id: d.id, type: "debt", title: d.name, subtitle: `Utang • ${d.lender}`, href: "/debts" })
  );
  (transactions.data ?? []).forEach((t) =>
    results.push({
      id: t.id, type: "transaction", title: t.name,
      subtitle: `Transaksi • Rp ${Number(t.amount).toLocaleString("id-ID")}`, href: "/transactions",
    })
  );
  (goals.data ?? []).forEach((g) =>
    results.push({
      id: g.id, type: "goal", title: g.name,
      subtitle: `Tujuan • Rp ${Number(g.target_amount).toLocaleString("id-ID")}`, href: "/goals",
    })
  );
  (wishlist.data ?? []).forEach((w) =>
    results.push({
      id: w.id, type: "wishlist", title: w.name,
      subtitle: `Wishlist • Rp ${Number(w.price).toLocaleString("id-ID")}`, href: "/wishlist",
    })
  );
  (receivables.data ?? []).forEach((r) =>
    results.push({ id: r.id, type: "receivable", title: r.name, subtitle: `Piutang • ${r.borrower}`, href: "/receivables" })
  );
  (accounts.data ?? []).forEach((a) =>
    results.push({ id: a.id, type: "account", title: a.name, subtitle: `Akun • ${a.type}`, href: "/accounts" })
  );

  return results;
}