import { describe, it, expect } from "vitest";
import { monthsToPayoff, addMonths, simulateExtraPayment } from "./debt-freedom";

describe("monthsToPayoff", () => {
    it("computes months needed, rounding up (partial month still counts as a full month)", () => {
        expect(monthsToPayoff(10_000_000, 3_000_000)).toBe(4); // 3.33 -> 4
    });

    it("returns 0 when there's no remaining debt", () => {
        expect(monthsToPayoff(0, 1_000_000)).toBe(0);
        expect(monthsToPayoff(-500, 1_000_000)).toBe(0);
    });

    it("returns null when monthly payment is 0 but debt still remains (can't estimate)", () => {
        expect(monthsToPayoff(5_000_000, 0)).toBeNull();
    });

    it("returns null when monthly payment is negative", () => {
        expect(monthsToPayoff(5_000_000, -100)).toBeNull();
    });

    it("computes exact whole-month payoff without rounding up unnecessarily", () => {
        expect(monthsToPayoff(6_000_000, 2_000_000)).toBe(3);
    });
});

describe("addMonths", () => {
    it("adds months and rolls over the year correctly", () => {
        const from = new Date(2026, 10, 15); // Nov 15, 2026
        const result = addMonths(3, from);
        expect(result.getFullYear()).toBe(2027);
        expect(result.getMonth()).toBe(1); // Feb (0-indexed)
        expect(result.getDate()).toBe(15);
    });

    it("adding 0 months returns the same date", () => {
        const from = new Date(2026, 5, 1);
        const result = addMonths(0, from);
        expect(result.getTime()).toBe(from.getTime());
    });
});

describe("simulateExtraPayment", () => {
    const from = new Date(2026, 0, 1); // Jan 1, 2026

    it("baseline matches monthsToPayoff with no extra payment", () => {
        const sim = simulateExtraPayment(10_000_000, 2_000_000, 0, from);
        expect(sim.baselineMonths).toBe(5);
        expect(sim.simulatedMonths).toBe(5);
        expect(sim.monthsAdvanced).toBe(0);
    });

    it("extra payment shortens the payoff timeline and reports months advanced", () => {
        // Remaining 10jt, pace 2jt/bulan -> 5 bulan. +500rb -> 2.5jt/bulan -> 4 bulan. Advanced = 1.
        const sim = simulateExtraPayment(10_000_000, 2_000_000, 500_000, from);
        expect(sim.baselineMonths).toBe(5);
        expect(sim.simulatedMonths).toBe(4);
        expect(sim.monthsAdvanced).toBe(1);
        expect(sim.baselineDate?.getMonth()).toBe(5); // Jan + 5 = Jun (index 5)
        expect(sim.simulatedDate?.getMonth()).toBe(4); // Jan + 4 = May (index 4)
    });

    it("ignores negative extra payment (treats as 0, does not slow down the pace)", () => {
        const sim = simulateExtraPayment(10_000_000, 2_000_000, -1_000_000, from);
        expect(sim.simulatedMonths).toBe(sim.baselineMonths);
    });

    it("returns null months/dates throughout when there's no payment history and no extra payment", () => {
        const sim = simulateExtraPayment(5_000_000, 0, 0, from);
        expect(sim.baselineMonths).toBeNull();
        expect(sim.baselineDate).toBeNull();
    });

    it("extra payment alone can produce an estimate even when baseline pace is 0", () => {
        const sim = simulateExtraPayment(5_000_000, 0, 1_000_000, from);
        expect(sim.baselineMonths).toBeNull();
        expect(sim.simulatedMonths).toBe(5);
        // monthsAdvanced can't be computed since baseline is unknown
        expect(sim.monthsAdvanced).toBeNull();
    });

    it("debt already at zero: baseline and simulated are both 0 regardless of pace", () => {
        const sim = simulateExtraPayment(0, 0, 500_000, from);
        expect(sim.baselineMonths).toBe(0);
        expect(sim.simulatedMonths).toBe(0);
        expect(sim.monthsAdvanced).toBe(0);
    });
});