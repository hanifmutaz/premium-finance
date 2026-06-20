// ─── User ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

// ─── Category ────────────────────────────────────────────────────────────────
export type CategoryType = "income" | "expense";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  created_at: string;
}

// ─── Transaction ─────────────────────────────────────────────────────────────
export type TransactionType = "income" | "expense" | "debt_payment" | "transfer";
export type TransactionStatus = "completed" | "pending" | "failed";
export type PaymentMethod = "cash" | "transfer" | "credit_card" | "debit_card" | "e-wallet" | "other";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  name: string;
  description?: string;
  category_id?: string;
  category?: Category;
  amount: number;
  date: string;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  attachment_url?: string;
  debt_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── Debt ─────────────────────────────────────────────────────────────────────
export type DebtStatus = "active" | "completed" | "overdue";
export type DebtPriority = "low" | "medium" | "high";

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  lender: string;
  total_amount: number;
  total_paid: number;
  remaining: number;
  start_date: string;
  due_date: string;
  priority: DebtPriority;
  status: DebtStatus;
  notes?: string;
  is_installment?: boolean;
  installment_amount?: number | null;
  tenor_months?: number | null;
  installments_paid?: number | null;
  next_due_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  transaction_id?: string;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

// ─── Goal ─────────────────────────────────────────────────────────────────────
export type GoalStatus = "active" | "completed" | "overdue" | "paused";
export type GoalPriority = "low" | "medium" | "high";

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  priority: GoalPriority;
  status: GoalStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export type WishlistPriority = "low" | "medium" | "high";
export type WishlistStatus = "pending" | "saved" | "purchased" | "cancelled";

export interface Wishlist {
  id: string;
  user_id: string;
  name: string;
  category: string;
  price: number;
  saved_amount: number;
  priority: WishlistPriority;
  target_date?: string;
  status: WishlistStatus;
  notes?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
export interface ForecastInput {
  monthly_income: number;
  fixed_expenses: number;
  debt_allocation: number;
  savings_allocation: number;
}

export interface ForecastPeriod {
  month: string;
  balance: number;
  cumulative_savings: number;
  remaining_debt: number;
}

export interface ForecastResult {
  periods: ForecastPeriod[];
  debt_free_date?: string;
  best_case: ForecastPeriod[];
  normal_case: ForecastPeriod[];
  worst_case: ForecastPeriod[];
}

// ─── Financial Health ─────────────────────────────────────────────────────────
export type HealthGrade = "A" | "B" | "C" | "D" | "E";

export interface FinancialScore {
  id: string;
  user_id: string;
  score: number;
  grade: HealthGrade;
  debt_ratio: number;
  savings_ratio: number;
  expense_ratio: number;
  cashflow_stability: number;
  target_achievement: number;
  recommendations: string[];
  calculated_at: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType = "debt_due" | "bill_due" | "goal_reminder" | "wishlist" | "savings" | "system";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  monthly_income: number;
  monthly_expense: number;
  monthly_remaining: number;
  current_balance: number;
  income_trend: number | null;
  expense_trend: number | null;
  total_active_debt: number;
  total_active_receivable: number;
  debt_paid_percentage: number;
  health_score: FinancialScore | null;
  nearest_due: Debt | null;
}

// ─── Chart Data ───────────────────────────────────────────────────────────────
export interface MonthlyChartData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryChartData {
  name: string;
  value: number;
  color: string;
}

// ─── Receivable (Piutang) ─────────────────────────────────────────────────────
export type ReceivableStatus = "active" | "completed" | "overdue";
export type ReceivablePriority = "low" | "medium" | "high";

export interface Receivable {
  id: string;
  user_id: string;
  name: string;         // nama catatan/deskripsi
  borrower: string;     // nama peminjam
  total_amount: number;
  total_received: number;
  remaining: number;
  start_date: string;
  due_date: string;
  priority: ReceivablePriority;
  status: ReceivableStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReceivablePayment {
  id: string;
  receivable_id: string;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

// ─── Budget & Planning ────────────────────────────────────────────────────────
export type BudgetPeriod = "monthly" | "weekly";

export interface BudgetCategory {
  id: string;
  budget_id: string;
  name: string;
  planned_amount: number;
  actual_amount: number;
  color?: string;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  period: BudgetPeriod;
  year: number;
  month?: number;   // 1-12, untuk monthly
  week?: number;    // 1-53, untuk weekly
  total_income: number;
  total_planned: number;
  total_actual: number;
  categories: BudgetCategory[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── Recurring Transaction ─────────────────────────────────────────────────────
export type RecurringFrequency = "monthly" | "weekly";

export interface RecurringTransaction {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  category_id?: string;
  category?: Category;
  payment_method: PaymentMethod;
  frequency: RecurringFrequency;
  day_of_period: number; // 1-31 for monthly, 0-6 for weekly (0=Sunday)
  start_date: string;
  end_date?: string;
  is_active: boolean;
  last_generated_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface TransactionFilters {
  type?: TransactionType;
  category_id?: string;
  status?: TransactionStatus;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  total_pages: number;
}