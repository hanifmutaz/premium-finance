import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  parseCurrency,
  formatPercent,
  clamp,
  calculateProgress,
  scoreToGrade,
  gradeColor,
  truncate,
  getInitials,
  formatInputNumber,
  parseInputNumber,
  isDebtActive,
} from "./index";

describe("formatCurrency", () => {
  it("formats a whole number as IDR with no decimals", () => {
    // Node's ICU may render a regular space or non-breaking space (\u00A0)
    // between "Rp" and the digits depending on the Node/ICU version — strip
    // whitespace before comparing so the test isn't environment-fragile.
    expect(formatCurrency(12500000).replace(/\s/g, "")).toBe("Rp12.500.000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0).replace(/\s/g, "")).toBe("Rp0");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-50000).replace(/\s/g, "")).toBe("-Rp50.000");
  });

  it("uses compact notation above 1 million when compact=true", () => {
    // e.g. "Rp12,5 jt" — assert it's shorter than the full form, not exact locale string
    const compact = formatCurrency(12500000, true);
    const full = formatCurrency(12500000, false);
    expect(compact.length).toBeLessThan(full.length);
  });

  it("does NOT compact below 1 million even if compact=true", () => {
    expect(formatCurrency(500000, true).replace(/\s/g, "")).toBe("Rp500.000");
  });
});

describe("parseCurrency", () => {
  it("parses a plain numeric string correctly", () => {
    expect(parseCurrency("125000")).toBe(125000);
  });

  it("returns 0 for garbage input", () => {
    expect(parseCurrency("abc")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseCurrency("")).toBe(0);
  });

  // KNOWN BUG (documented, not fixed here — function is currently unused
  // anywhere in the app, so this is dead code with a latent issue rather
  // than an active one): parseFloat stops at the second "." it encounters,
  // so a real Rupiah-formatted string like "Rp12.500.000" parses to 12.5
  // instead of 12500000. If this function is ever wired up to parse
  // dot-separated IDR input, it needs to strip thousand-separator dots
  // first (see formatInputNumber/parseInputNumber below, which handle
  // this correctly via digit-only stripping).
  it("does NOT correctly parse dot-formatted IDR strings (documents existing bug)", () => {
    expect(parseCurrency("Rp12.500.000")).toBe(12.5);
  });
});

describe("calculateProgress", () => {
  it("computes percentage of current over total", () => {
    expect(calculateProgress(50, 100)).toBe(50);
  });

  it("clamps to 100 when current exceeds total (budget overspend case)", () => {
    expect(calculateProgress(150, 100)).toBe(100);
  });

  it("clamps to 0 when current is negative", () => {
    expect(calculateProgress(-10, 100)).toBe(0);
  });

  it("returns 0 when total is 0 (avoids divide-by-zero)", () => {
    expect(calculateProgress(50, 0)).toBe(0);
  });
});

describe("clamp", () => {
  it("returns value unchanged when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("formatPercent", () => {
  it("formats with default 1 decimal", () => {
    expect(formatPercent(33.333)).toBe("33.3%");
  });
  it("formats with custom decimals", () => {
    expect(formatPercent(33.333, 0)).toBe("33%");
  });
});

describe("scoreToGrade", () => {
  it.each([
    [90, "A"],
    [85, "A"],
    [75, "B"],
    [70, "B"],
    [60, "C"],
    [55, "C"],
    [45, "D"],
    [40, "D"],
    [10, "E"],
    [0, "E"],
  ])("maps score %i to grade %s", (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});

describe("gradeColor", () => {
  it("returns a hex color for known grades", () => {
    expect(gradeColor("A")).toMatch(/^#[0-9A-F]{6}$/i);
  });
  it("falls back to a default color for unknown grade", () => {
    expect(gradeColor("Z")).toBe("#94A3B8");
  });
});

describe("truncate", () => {
  it("leaves short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates long strings with an ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
  });
});

describe("getInitials", () => {
  it("gets initials from a two-word name", () => {
    expect(getInitials("Muhammad Hanif")).toBe("MH");
  });
  it("caps at 2 characters for multi-word names", () => {
    expect(getInitials("Muhammad Hanif Mutaz")).toBe("MH");
  });
});

describe("formatInputNumber / parseInputNumber round-trip", () => {
  it("formats raw digits with thousand separators", () => {
    expect(formatInputNumber("12500000")).toBe("12.500.000");
  });
  it("returns empty string for '0' or empty input", () => {
    expect(formatInputNumber("0")).toBe("");
    expect(formatInputNumber("")).toBe("");
  });
  it("round-trips display back to raw digits", () => {
    const raw = "12500000";
    const display = formatInputNumber(raw);
    expect(parseInputNumber(display)).toBe(raw);
  });
});

describe("isDebtActive", () => {
  it("treats 'active' as active", () => {
    expect(isDebtActive("active")).toBe(true);
  });
  it("treats 'overdue' as active (still has a balance owed)", () => {
    expect(isDebtActive("overdue")).toBe(true);
  });
  it("treats 'completed' as NOT active", () => {
    expect(isDebtActive("completed")).toBe(false);
  });
  it("treats unknown status strings as NOT active", () => {
    expect(isDebtActive("cancelled")).toBe(false);
  });
});