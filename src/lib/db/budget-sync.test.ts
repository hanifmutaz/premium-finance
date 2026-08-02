import { describe, it, expect } from "vitest";
import { matchBudgetCategory } from "./budget-sync";

type Cat = {
  id: string;
  name: string;
  mapped_category_ids: string[] | null;
  keyword_filter: string | null;
};

function cat(overrides: Partial<Cat> & { id: string; name: string }): Cat {
  return {
    mapped_category_ids: null,
    keyword_filter: null,
    ...overrides,
  };
}

describe("matchBudgetCategory", () => {
  it("priority 1: matches by mapped_category_ids + keyword_filter together", () => {
    const cats = [
      cat({ id: "1", name: "Kopi", mapped_category_ids: ["cat-makan"], keyword_filter: "kopi" }),
      cat({ id: "2", name: "Makan Lain", mapped_category_ids: ["cat-makan"] }),
    ];
    const result = matchBudgetCategory(cats, "cat-makan", "Makan", "Beli kopi pagi");
    expect(result?.id).toBe("1");
  });

  it("priority 1 fails over to priority 2 when keyword_filter does not match transaction name", () => {
    const cats = [
      cat({ id: "1", name: "Kopi", mapped_category_ids: ["cat-makan"], keyword_filter: "kopi" }),
      cat({ id: "2", name: "Makan Lain", mapped_category_ids: ["cat-makan"] }),
    ];
    // txName doesn't contain "kopi", so cat 1 is skipped, cat 2 (no keyword_filter) matches
    const result = matchBudgetCategory(cats, "cat-makan", "Makan", "Nasi padang");
    expect(result?.id).toBe("2");
  });

  it("priority 3: falls back to keyword_filter match on transaction name when no category id given", () => {
    const cats = [
      cat({ id: "1", name: "Rokok", keyword_filter: "rokok" }),
      cat({ id: "2", name: "Transport", keyword_filter: "bensin" }),
    ];
    // No txCategoryId (e.g. debt_payment/saving transactions have none)
    const result = matchBudgetCategory(cats, null, "", "Beli rokok sebungkus");
    expect(result?.id).toBe("1");
  });

  it("priority 3 keyword match is case-insensitive", () => {
    const cats = [cat({ id: "1", name: "Rokok", keyword_filter: "ROKOK" })];
    const result = matchBudgetCategory(cats, null, "", "beli rokok");
    expect(result?.id).toBe("1");
  });

  it("priority 4: falls back to exact category name match (case-insensitive)", () => {
    const cats = [
      cat({ id: "1", name: "Belanja" }),
      cat({ id: "2", name: "Kost" }),
    ];
    const result = matchBudgetCategory(cats, null, "belanja", "Beli baju");
    expect(result?.id).toBe("1");
  });

  it("returns null when nothing matches (transaction should NOT silently roll into a wrong category)", () => {
    const cats = [cat({ id: "1", name: "Kost" })];
    const result = matchBudgetCategory(cats, "cat-other", "Lain-lain", "Random purchase");
    expect(result).toBeNull();
  });

  it("returns null for an empty category list", () => {
    const result = matchBudgetCategory([], "cat-x", "Makan", "Nasi goreng");
    expect(result).toBeNull();
  });

  it("does not cross-match mapped_category_ids that don't include the transaction's category", () => {
    const cats = [cat({ id: "1", name: "Minggu 1", mapped_category_ids: ["cat-makan"] })];
    const result = matchBudgetCategory(cats, "cat-transport", "Transport", "Bensin motor");
    // Falls through to priority 4 (exact name match) — "Transport" !== "Minggu 1", so null
    expect(result).toBeNull();
  });

  it("priority order: mapped_category_ids match wins over exact name match even if name also matches", () => {
    const cats = [
      cat({ id: "1", name: "Makan", mapped_category_ids: ["cat-makan"] }),
      cat({ id: "2", name: "Makan" }), // duplicate name, would also match priority 4
    ];
    const result = matchBudgetCategory(cats, "cat-makan", "Makan", null);
    expect(result?.id).toBe("1");
  });
});
