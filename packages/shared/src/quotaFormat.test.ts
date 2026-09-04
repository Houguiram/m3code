import { describe, expect, it } from "vite-plus/test";
import type { QuotaWindow } from "@t3tools/contracts";

import {
  formatQuotaCountdown,
  formatQuotaSummary,
  remainingPercentFromUsed,
} from "./quotaFormat.ts";

const session: QuotaWindow = {
  kind: "session",
  label: "Session",
  usedPercent: 44,
  remainingPercent: 56,
  resetAt: "2026-09-02T02:26:52Z",
};

describe("quotaFormat", () => {
  it("derives remaining from used percent", () => {
    expect(remainingPercentFromUsed(21.6744)).toBeCloseTo(78.3256);
    expect(remainingPercentFromUsed(100)).toBe(0);
  });

  it("formats a compact countdown", () => {
    const now = Date.parse("2026-09-01T22:26:52Z");
    expect(formatQuotaCountdown(session.resetAt, now)).toBe("4h");
    expect(formatQuotaSummary([session], now)).toBe("Session 56% left · 4h");
  });
});
