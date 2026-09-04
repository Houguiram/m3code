/**
 * Display formatting for remaining subscription windows.
 *
 * @module quotaFormat
 */
import type { QuotaWindow } from "@t3tools/contracts";

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function remainingPercentFromUsed(usedPercent: number): number {
  return clampPercent(100 - usedPercent);
}

export function formatQuotaCountdown(resetAt: string | null, nowMs: number): string | null {
  if (resetAt === null) return null;
  const resetMs = Date.parse(resetAt);
  if (!Number.isFinite(resetMs)) return null;
  const deltaMs = resetMs - nowMs;
  if (deltaMs <= 0) return "resetting";
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function formatQuotaWindow(window: QuotaWindow, nowMs: number): string {
  const remaining = Math.round(clampPercent(window.remainingPercent));
  const countdown = formatQuotaCountdown(window.resetAt, nowMs);
  return countdown === null
    ? `${window.label} ${remaining}% left`
    : `${window.label} ${remaining}% left · ${countdown}`;
}

export function formatQuotaSummary(
  windows: readonly QuotaWindow[],
  nowMs: number,
  limit = 2,
): string {
  return windows
    .slice(0, limit)
    .map((window) => formatQuotaWindow(window, nowMs))
    .join(" · ");
}
