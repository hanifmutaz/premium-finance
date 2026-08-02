import { describe, it, expect } from "vitest";
import {
    calcTotalDebt,
    calcGoalProgress,
    calcWishlistProgress,
    generateForecast,
    calculateHealthScore,
} from "./calculations";
import type { Debt, Goal, Wishlist, ForecastInput } from "@/types";

function makeDebt(overrides: Partial<Debt> = {}): Debt {
    return {
        id: "d1", user_id: "u1", name: "Test Debt", lender: "Test Lender",
        total_amount: 1_000_000, total_paid: 0, remaining: 1_000_000,
        start_date: "2026-01-01", due_date: "2026-12-31",
        priority: "medium", status: "active",
        created_at: "2026-01-01", updated_at: "2026-01-01",
        ...overrides,
    };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
    return {
        id: "g1", user_id: "u1", name: "Test Goal",
        target_amount: 10_000_000, current_amount: 2_500_000,
        deadline: "2027-01-01", priority: "medium", status: "active",
        created_at: "2026-01-01", updated_at: "2026-01-01",
        ...overrides,
    };
}

function makeWishlist(overrides: Partial<Wishlist> = {}): Wishlist {
    return {
        id: "w1", user_id: "u1", name: "Test Item", category: "Elektronik",
        price: 5_000_000, saved_amount: 1_000_000, priority: "medium",
        status: "pending", created_at: "2026-01-01", updated_at: "2026-01-01",
        ...overrides,
    };
}

describe("calcTotalDebt", () => {
    it("sums remaining for both active and overdue debts", () => {
        const debts = [
            makeDebt({ id: "1", remaining: 1_000_000, status: "active" }),
            makeDebt({ id: "2", remaining: 500_000, status: "completed" }),
            makeDebt({ id: "3", remaining: 300_000, status: "active" }),
            makeDebt({ id: "4", remaining: 200_000, status: "overdue" }),
        ];
        expect(calcTotalDebt(debts)).toBe(1_500_000);
    });

    it("returns 0 for an empty list", () => {
        expect(calcTotalDebt([])).toBe(0);
    });
});

describe("calcGoalProgress", () => {
    it("computes percentage, remaining, and monthly/weekly needed", () => {
        // Deadline exactly 10 calendar months from now
        const today = new Date();
        const deadline = new Date(today.getFullYear(), today.getMonth() + 10, today.getDate());
        const goal = makeGoal({
            target_amount: 10_000_000,
            current_amount: 4_000_000,
            deadline: deadline.toISOString().slice(0, 10),
        });
        const result = calcGoalProgress(goal);
        expect(result.percentage).toBe(40);
        expect(result.remaining).toBe(6_000_000);
        expect(result.monthsLeft).toBe(10);
        expect(result.monthlyNeeded).toBe(600_000);
        expect(result.weeklyNeeded).toBe(150_000);
    });

    it("caps percentage at 100 even if current exceeds target (overachieved goal)", () => {
        const goal = makeGoal({ target_amount: 1_000_000, current_amount: 1_500_000 });
        expect(calcGoalProgress(goal).percentage).toBe(100);
    });

    it("does NOT divide by zero when target_amount is 0 — returns 0% instead of Infinity/NaN", () => {
        const goal = makeGoal({ target_amount: 0, current_amount: 500_000 });
        const result = calcGoalProgress(goal);
        expect(result.percentage).toBe(0);
        expect(Number.isFinite(result.percentage)).toBe(true);
        expect(Number.isNaN(result.percentage)).toBe(false);
    });

    it("clamps monthsLeft to at least 1 even for a past/overdue deadline", () => {
        const goal = makeGoal({ deadline: "2020-01-01" });
        expect(calcGoalProgress(goal).monthsLeft).toBeGreaterThanOrEqual(1);
    });
});

describe("calcWishlistProgress", () => {
    it("computes percentage, remaining, and months needed at a given surplus", () => {
        const item = makeWishlist({ price: 5_000_000, saved_amount: 1_000_000 });
        const result = calcWishlistProgress(item, 500_000);
        expect(result.percentage).toBe(20);
        expect(result.remaining).toBe(4_000_000);
        expect(result.monthsNeeded).toBe(8);
        expect(result.canBuy).toBe(false);
    });

    it("does NOT divide by zero when price is 0 — returns 0% instead of Infinity/NaN", () => {
        const item = makeWishlist({ price: 0, saved_amount: 500_000 });
        const result = calcWishlistProgress(item, 500_000);
        expect(result.percentage).toBe(0);
        expect(Number.isFinite(result.percentage)).toBe(true);
    });

    it("marks canBuy true and gives the 'ready to buy' recommendation once saved >= price", () => {
        const item = makeWishlist({ price: 1_000_000, saved_amount: 1_000_000 });
        const result = calcWishlistProgress(item, 100_000);
        expect(result.canBuy).toBe(true);
        expect(result.recommendation).toContain("Siap dibeli");
    });

    it("returns Infinity months and 'Tidak tentu' date when there's no monthly surplus", () => {
        const item = makeWishlist({ price: 1_000_000, saved_amount: 0 });
        const result = calcWishlistProgress(item, 0);
        expect(result.monthsNeeded).toBe(Infinity);
        expect(result.estimatedDate).toBe("Tidak tentu");
    });

    it("recommendation nudges toward 'tunda' when not yet affordable but close (<=3 months)", () => {
        const item = makeWishlist({ price: 1_000_000, saved_amount: 800_000 });
        const result = calcWishlistProgress(item, 100_000); // 2 months needed
        expect(result.recommendation).toContain("hampir tercapai");
    });
});

describe("generateForecast", () => {
    const baseInput: ForecastInput = {
        monthly_income: 5_000_000,
        fixed_expenses: 2_000_000,
        debt_allocation: 1_000_000,
        savings_allocation: 500_000,
    };

    it("pays down debt month by month and stops at 0 (never goes negative)", () => {
        const result = generateForecast(baseInput, 2_500_000, 6);
        const debts = result.normal_case.map((p) => p.remaining_debt);
        // 2.5jt debt, 1jt/bulan payment -> lunas bulan ke-3, tetep 0 setelahnya
        expect(debts[0]).toBe(1_500_000);
        expect(debts[1]).toBe(500_000);
        expect(debts[2]).toBe(0);
        expect(debts[3]).toBe(0);
        expect(debts.every((d) => d >= 0)).toBe(true);
    });

    it("reports the debt_free_date at the first month remaining_debt hits 0", () => {
        const result = generateForecast(baseInput, 2_500_000, 6);
        expect(result.debt_free_date).toBe(result.normal_case[2].month);
    });

    it("leaves debt_free_date undefined when debt isn't paid off within the horizon", () => {
        const result = generateForecast(baseInput, 100_000_000, 6);
        expect(result.debt_free_date).toBeUndefined();
    });

    it("best case uses higher income / lower expense multipliers than normal case", () => {
        const result = generateForecast(baseInput, 2_500_000, 3);
        expect(result.best_case[0].balance).toBeGreaterThan(result.normal_case[0].balance);
    });

    it("worst case uses lower income / higher expense multipliers than normal case", () => {
        const result = generateForecast(baseInput, 2_500_000, 3);
        expect(result.worst_case[0].balance).toBeLessThan(result.normal_case[0].balance);
    });

    it("returns exactly `months` periods", () => {
        const result = generateForecast(baseInput, 1_000_000, 9);
        expect(result.normal_case).toHaveLength(9);
    });
});

describe("calculateHealthScore", () => {
    it("gives a healthy score for good financial habits (low debt, high savings)", () => {
        const result = calculateHealthScore({
            monthlyIncome: 10_000_000,
            monthlyExpense: 4_000_000,
            totalDebt: 5_000_000, // low relative to annual income
            monthlySavings: 3_000_000, // 30% savings ratio
            goals: [],
        });
        expect(result.score).toBeGreaterThan(70);
        expect(result.grade).toBe("A");
    });

    it("gives a poor score for bad financial habits (high debt, negative cashflow)", () => {
        const result = calculateHealthScore({
            monthlyIncome: 3_000_000,
            monthlyExpense: 4_000_000, // spending more than earning
            totalDebt: 50_000_000, // very high relative to income
            monthlySavings: 0,
            goals: [],
        });
        expect(result.score).toBeLessThan(40);
        expect(result.recommendations).toContain("Cashflow negatif! Segera evaluasi pengeluaran rutin");
    });

    it("handles zero income without dividing by zero (all ratio scores stay finite)", () => {
        const result = calculateHealthScore({
            monthlyIncome: 0,
            monthlyExpense: 0,
            totalDebt: 0,
            monthlySavings: 0,
            goals: [],
        });
        expect(Number.isFinite(result.score)).toBe(true);
        expect(Number.isNaN(result.score)).toBe(false);
    });

    it("does NOT divide by zero when an active goal has target_amount 0", () => {
        const goals: Goal[] = [makeGoal({ target_amount: 0, current_amount: 100_000, status: "active" })];
        const result = calculateHealthScore({
            monthlyIncome: 5_000_000,
            monthlyExpense: 2_000_000,
            totalDebt: 1_000_000,
            monthlySavings: 1_000_000,
            goals,
        });
        expect(Number.isFinite(result.target_achievement)).toBe(true);
        expect(Number.isNaN(result.target_achievement)).toBe(false);
    });

    it("defaults target_achievement to 50 when there are no active goals", () => {
        const result = calculateHealthScore({
            monthlyIncome: 5_000_000,
            monthlyExpense: 2_000_000,
            totalDebt: 1_000_000,
            monthlySavings: 1_000_000,
            goals: [],
        });
        expect(result.target_achievement).toBe(50);
    });

    it("recommends reducing debt when debt ratio exceeds 40%", () => {
        const result = calculateHealthScore({
            monthlyIncome: 5_000_000,
            monthlyExpense: 2_000_000,
            totalDebt: 30_000_000, // ratio = 30jt / 60jt annual = 50%
            monthlySavings: 1_000_000,
            goals: [],
        });
        expect(result.recommendations).toContain("Kurangi rasio utang di bawah 30% untuk kesehatan finansial optimal");
    });
});