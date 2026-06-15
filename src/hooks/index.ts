import { useMemo } from "react";
import { useAppStore } from "@/store";
import { calculateProgress } from "@/utils";
import { calculateHealthScore } from "@/lib/calculations";

// ─── useTransactions ──────────────────────────────────────────────────────────
export function useTransactions(filters?: {
  type?: string;
  search?: string;
  month?: number;
  year?: number;
}) {
  const transactions = useAppStore((s) => s.transactions);

  return useMemo(() => {
    let result = [...transactions];

    if (filters?.type && filters.type !== "all") {
      result = result.filter((t) => t.type === filters.type);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category?.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    if (filters?.month !== undefined && filters.year !== undefined) {
      result = result.filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === filters.month && d.getFullYear() === filters.year;
      });
    }

    return result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions, filters?.type, filters?.search, filters?.month, filters?.year]);
}

// ─── useDebts ─────────────────────────────────────────────────────────────────
export function useDebts(status?: "active" | "completed" | "overdue") {
  const debts = useAppStore((s) => s.debts);

  return useMemo(() => {
    const filtered = status ? debts.filter((d) => d.status === status) : debts;
    return filtered.sort((a, b) => {
      // High priority first
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [debts, status]);
}

// ─── useGoals ─────────────────────────────────────────────────────────────────
export function useGoals(status?: string) {
  const goals = useAppStore((s) => s.goals);

  return useMemo(() => {
    const filtered = status ? goals.filter((g) => g.status === status) : goals;
    return filtered.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [goals, status]);
}

// ─── useMonthlyStats ──────────────────────────────────────────────────────────
export function useMonthlyStats(month?: number, year?: number) {
  const transactions = useAppStore((s) => s.transactions);

  return useMemo(() => {
    const now = new Date();
    const m = month ?? now.getMonth();
    const y = year ?? now.getFullYear();

    const monthly = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    const income = monthly
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);

    const expense = monthly
      .filter((t) => t.type !== "income")
      .reduce((s, t) => s + t.amount, 0);

    const byCategory = monthly
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => {
        const cat = t.category?.name ?? "Lainnya";
        acc[cat] = (acc[cat] ?? 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    return {
      income,
      expense,
      net: income - expense,
      savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
      byCategory,
      count: monthly.length,
    };
  }, [transactions, month, year]);
}

// ─── useFinancialHealth ───────────────────────────────────────────────────────
export function useFinancialHealth() {
  const transactions = useAppStore((s) => s.transactions);
  const debts = useAppStore((s) => s.debts);
  const goals = useAppStore((s) => s.goals);

  return useMemo(() => {
    const now = new Date();
    const monthly = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const monthlyIncome = monthly
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);

    const monthlyExpense = monthly
      .filter((t) => t.type !== "income")
      .reduce((s, t) => s + t.amount, 0);

    const totalDebt = debts
      .filter((d) => d.status === "active")
      .reduce((s, d) => s + d.remaining, 0);

    const monthlySavings = Math.max(0, monthlyIncome - monthlyExpense);

    return calculateHealthScore({
      monthlyIncome,
      monthlyExpense,
      totalDebt,
      monthlySavings,
      goals,
    });
  }, [transactions, debts, goals]);
}

// ─── useUnreadNotifications ───────────────────────────────────────────────────
export function useUnreadNotifications() {
  const notifications = useAppStore((s) => s.notifications);
  return useMemo(
    () => notifications.filter((n) => !n.is_read),
    [notifications]
  );
}

// ─── useWishlist ──────────────────────────────────────────────────────────────
export function useWishlist(status?: string) {
  const wishlist = useAppStore((s) => s.wishlist);

  return useMemo(() => {
    const filtered = status ? wishlist.filter((w) => w.status === status) : wishlist;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [wishlist, status]);
}
