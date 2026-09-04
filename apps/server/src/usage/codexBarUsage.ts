/**
 * Lenient CodexBar `usage --format json` decoder.
 *
 * CodexBar's JSON is display-oriented and changes across releases. We only
 * lift the fields needed to join remaining windows onto provider instances.
 *
 * @module codexBarUsage
 */
import {
  QuotaProviderKind,
  type QuotaAccount,
  type QuotaProviderKind as QuotaProviderKindType,
  type QuotaWindow,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { remainingPercentFromUsed } from "@t3tools/shared/quotaFormat";
import { quotaAccountKey, quotaAccountLabel } from "@t3tools/shared/quotaMatch";

const optionalString = Schema.optionalKey(Schema.NullOr(Schema.String));

const CodexBarUsageWindow = Schema.Struct({
  usedPercent: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  resetsAt: optionalString,
  resetDescription: optionalString,
  windowMinutes: Schema.optionalKey(Schema.NullOr(Schema.Number)),
});
type CodexBarUsageWindow = typeof CodexBarUsageWindow.Type;

const CodexBarExtraRateWindow = Schema.Struct({
  id: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
  window: Schema.optionalKey(Schema.NullOr(CodexBarUsageWindow)),
});

const CodexBarUsageIdentity = Schema.Struct({
  accountEmail: optionalString,
  accountOrganization: optionalString,
  loginMethod: optionalString,
});

const CodexBarUsageBody = Schema.Struct({
  accountEmail: optionalString,
  accountOrganization: optionalString,
  loginMethod: optionalString,
  identity: Schema.optionalKey(Schema.NullOr(CodexBarUsageIdentity)),
  primary: Schema.optionalKey(Schema.NullOr(CodexBarUsageWindow)),
  secondary: Schema.optionalKey(Schema.NullOr(CodexBarUsageWindow)),
  tertiary: Schema.optionalKey(Schema.NullOr(CodexBarUsageWindow)),
  extraRateWindows: Schema.optionalKey(Schema.Array(CodexBarExtraRateWindow)),
});
type CodexBarUsageBody = typeof CodexBarUsageBody.Type;

const CodexBarUsageItem = Schema.Struct({
  provider: Schema.String,
  account: optionalString,
  error: Schema.optionalKey(Schema.Unknown),
  usage: Schema.optionalKey(Schema.NullOr(CodexBarUsageBody)),
});

const CodexBarUsageDocument = Schema.Union([CodexBarUsageItem, Schema.Array(CodexBarUsageItem)]);

const decodeDocument = Schema.decodeUnknownOption(CodexBarUsageDocument);
const isQuotaProviderKind = Schema.is(QuotaProviderKind);

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function windowFrom(
  kind: string,
  label: string,
  raw: CodexBarUsageWindow | null | undefined,
): QuotaWindow | null {
  if (raw?.usedPercent === undefined || raw.usedPercent === null) {
    return null;
  }
  return {
    kind,
    label,
    usedPercent: raw.usedPercent,
    remainingPercent: remainingPercentFromUsed(raw.usedPercent),
    resetAt: nonEmpty(raw.resetsAt),
  };
}

function windowsFromUsage(
  usage: CodexBarUsageBody,
  provider: QuotaProviderKindType,
): QuotaWindow[] {
  const primaryLabel = provider === "cursor" ? "Total" : "Session";
  const windows: QuotaWindow[] = [];
  const primary = windowFrom("session", primaryLabel, usage.primary ?? undefined);
  const secondary = windowFrom(
    "weekly",
    provider === "cursor" ? "Cursor" : "Weekly",
    usage.secondary ?? undefined,
  );
  const tertiary = windowFrom("tertiary", "Third Party", usage.tertiary ?? undefined);
  if (primary) windows.push(primary);
  if (secondary) windows.push(secondary);
  if (tertiary) windows.push(tertiary);
  for (const extra of usage.extraRateWindows ?? []) {
    const extraWindow = windowFrom(
      extra.id?.trim() || "extra",
      extra.title?.trim() || extra.id?.trim() || "Extra",
      extra.window ?? undefined,
    );
    if (extraWindow) windows.push(extraWindow);
  }
  return windows;
}

function accountFromItem(item: typeof CodexBarUsageItem.Type): QuotaAccount | null {
  if (item.error !== undefined) return null;
  if (!isQuotaProviderKind(item.provider)) return null;
  const usage = item.usage;
  if (usage === undefined || usage === null) return null;

  const email = nonEmpty(usage.accountEmail) ?? nonEmpty(usage.identity?.accountEmail);
  const organization =
    nonEmpty(usage.accountOrganization) ?? nonEmpty(usage.identity?.accountOrganization);
  const plan = nonEmpty(usage.loginMethod) ?? nonEmpty(usage.identity?.loginMethod);
  const labelSource = nonEmpty(item.account) ?? email ?? item.provider;
  const windows = windowsFromUsage(usage, item.provider);
  if (windows.length === 0) return null;

  const label = quotaAccountLabel({
    email,
    organization,
    label: labelSource,
  });
  return {
    key: quotaAccountKey({
      provider: item.provider,
      email,
      organization,
      label,
    }),
    provider: item.provider,
    label,
    email,
    organization,
    plan,
    windows,
  };
}

export function parseCodexBarUsageJson(raw: string): readonly QuotaAccount[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return [];
  }
  const document = decodeDocument(decoded);
  if (document._tag === "None") return [];
  const items = Array.isArray(document.value) ? document.value : [document.value];
  const accounts: QuotaAccount[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const account = accountFromItem(item);
    if (account === null || seen.has(account.key)) continue;
    seen.add(account.key);
    accounts.push(account);
  }
  return accounts;
}

export function mergeQuotaAccounts(
  groups: ReadonlyArray<ReadonlyArray<QuotaAccount>>,
): readonly QuotaAccount[] {
  const byKey = new Map<string, QuotaAccount>();
  for (const group of groups) {
    for (const account of group) {
      const existing = byKey.get(account.key);
      if (existing === undefined) {
        byKey.set(account.key, account);
        continue;
      }
      byKey.set(account.key, {
        ...existing,
        email: existing.email ?? account.email,
        organization: existing.organization ?? account.organization,
        plan: existing.plan ?? account.plan,
        label: existing.label.length > 0 ? existing.label : account.label,
        windows: existing.windows.length > 0 ? existing.windows : account.windows,
      });
    }
  }
  return [...byKey.values()];
}
