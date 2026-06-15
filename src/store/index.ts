import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Transaction,
  Debt,
  Goal,
  Wishlist,
  Notification,
  DashboardStats,
  User,
} from "@/types";
import {
  mockTransactions,
  mockDebts,
  mockGoals,
  mockWishlist,
  mockNotifications,
  mockDashboardStats,
  mockUser,
} from "@/lib/mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AppState {
  // Auth
  user: typeof mockUser | null;
  setUser: (user: typeof mockUser | null) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, tx: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Debts
  debts: Debt[];
  addDebt: (debt: Debt) => void;
  updateDebt: (id: string, debt: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  recordDebtPayment: (debtId: string, amount: number) => void;

  // Goals
  goals: Goal[];
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, goal: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  // Wishlist
  wishlist: Wishlist[];
  addWishlistItem: (item: Wishlist) => void;
  updateWishlistItem: (id: string, item: Partial<Wishlist>) => void;
  deleteWishlistItem: (id: string) => void;

  // Notifications
  notifications: Notification[];
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;

  // Dashboard
  dashboardStats: DashboardStats;
  refreshDashboard: () => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Auth ────────────────────────────────────────────────────────────────
      user: mockUser,
      setUser: (user) => set({ user }),

      // ── Transactions ────────────────────────────────────────────────────────
      transactions: mockTransactions,

      addTransaction: (tx) =>
        set((s) => ({ transactions: [tx, ...s.transactions] })),

      updateTransaction: (id, tx) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...tx, updated_at: new Date().toISOString() } : t
          ),
        })),

      deleteTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      // ── Debts ───────────────────────────────────────────────────────────────
      debts: mockDebts,

      addDebt: (debt) => set((s) => ({ debts: [debt, ...s.debts] })),

      updateDebt: (id, debt) =>
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === id ? { ...d, ...debt, updated_at: new Date().toISOString() } : d
          ),
        })),

      deleteDebt: (id) =>
        set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

      recordDebtPayment: (debtId, amount) => {
        const now = new Date().toISOString();
        set((s) => {
          const debts = s.debts.map((d) => {
            if (d.id !== debtId) return d;
            const newPaid = d.total_paid + amount;
            const newRemaining = Math.max(0, d.total_amount - newPaid);
            return {
              ...d,
              total_paid: newPaid,
              remaining: newRemaining,
              status: newRemaining === 0 ? "completed" as const : d.status,
              updated_at: now,
            };
          });

          // Auto-add to transactions
          const debt = debts.find((d) => d.id === debtId);
          const newTx: Transaction = {
            id: `tx-${Date.now()}`,
            user_id: s.user?.id ?? "user-1",
            type: "debt_payment",
            name: `Bayar Utang: ${debt?.name ?? ""}`,
            amount,
            date: new Date().toISOString().split("T")[0],
            payment_method: "transfer",
            status: "completed",
            debt_id: debtId,
            created_at: now,
            updated_at: now,
          };

          return {
            debts,
            transactions: [newTx, ...s.transactions],
          };
        });

        // Refresh dashboard
        get().refreshDashboard();
      },

      // ── Goals ───────────────────────────────────────────────────────────────
      goals: mockGoals,

      addGoal: (goal) => set((s) => ({ goals: [goal, ...s.goals] })),

      updateGoal: (id, goal) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id ? { ...g, ...goal, updated_at: new Date().toISOString() } : g
          ),
        })),

      deleteGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      // ── Wishlist ────────────────────────────────────────────────────────────
      wishlist: mockWishlist,

      addWishlistItem: (item) =>
        set((s) => ({ wishlist: [item, ...s.wishlist] })),

      updateWishlistItem: (id, item) =>
        set((s) => ({
          wishlist: s.wishlist.map((w) =>
            w.id === id ? { ...w, ...item, updated_at: new Date().toISOString() } : w
          ),
        })),

      deleteWishlistItem: (id) =>
        set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),

      // ── Notifications ───────────────────────────────────────────────────────
      notifications: mockNotifications,

      markNotifRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
        })),

      markAllNotifsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        })),

      // ── Dashboard ───────────────────────────────────────────────────────────
      dashboardStats: mockDashboardStats,

      refreshDashboard: () => {
        const { transactions, debts } = get();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyTx = transactions.filter((tx) => {
          const d = new Date(tx.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const monthly_income = monthlyTx
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);

        const monthly_expense = monthlyTx
          .filter((t) => t.type !== "income")
          .reduce((s, t) => s + t.amount, 0);

        const activeDebts = debts.filter((d) => d.status === "active");
        const total_active_debt = activeDebts.reduce((s, d) => s + d.remaining, 0);
        const totalDebtAmount = activeDebts.reduce((s, d) => s + d.total_amount, 0);
        const totalDebtPaid = activeDebts.reduce((s, d) => s + d.total_paid, 0);

        set((s) => ({
          dashboardStats: {
            ...s.dashboardStats,
            monthly_income,
            monthly_expense,
            monthly_remaining: monthly_income - monthly_expense,
            total_active_debt,
            debt_paid_percentage:
              totalDebtAmount > 0
                ? Math.round((totalDebtPaid / totalDebtAmount) * 100)
                : 0,
          },
        }));
      },

      // ── UI ──────────────────────────────────────────────────────────────────
      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
    }),
    {
      name: "premium-finance-store",
      partialize: (s) => ({
        user: s.user,
        transactions: s.transactions,
        debts: s.debts,
        goals: s.goals,
        wishlist: s.wishlist,
        notifications: s.notifications,
      }),
    }
  )
);
