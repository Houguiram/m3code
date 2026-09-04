/**
 * Remaining subscription quota, sourced from the local CodexBar CLI.
 *
 * Distinct from {@link UsageSummary}: that page is a local token/cost scan.
 * This snapshot is account-level remaining limits (5-hour / weekly / plan
 * windows) keyed to configured provider instances.
 *
 * @module quota
 */
import * as Schema from "effect/Schema";

import { NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";

export const QuotaProviderKind = Schema.Literals(["claude", "codex", "cursor"]);
export type QuotaProviderKind = typeof QuotaProviderKind.Type;

export const QuotaMatchKind = Schema.Literals([
  "manual",
  "email",
  "sole",
  "unmatched",
  "ambiguous",
]);
export type QuotaMatchKind = typeof QuotaMatchKind.Type;

export const QuotaWindow = Schema.Struct({
  kind: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  usedPercent: Schema.Number,
  remainingPercent: Schema.Number,
  resetAt: Schema.NullOr(TrimmedNonEmptyString),
});
export type QuotaWindow = typeof QuotaWindow.Type;

export const QuotaAccount = Schema.Struct({
  /** Stable join key: provider + email + organization (or label fallback). */
  key: TrimmedNonEmptyString,
  provider: QuotaProviderKind,
  label: TrimmedNonEmptyString,
  email: Schema.NullOr(TrimmedNonEmptyString),
  organization: Schema.NullOr(TrimmedNonEmptyString),
  plan: Schema.NullOr(TrimmedNonEmptyString),
  windows: Schema.Array(QuotaWindow),
});
export type QuotaAccount = typeof QuotaAccount.Type;

export const QuotaInstanceBinding = Schema.Struct({
  instanceId: ProviderInstanceId,
  driver: ProviderDriverKind,
  match: QuotaMatchKind,
  account: Schema.NullOr(QuotaAccount),
});
export type QuotaInstanceBinding = typeof QuotaInstanceBinding.Type;

export const QuotaSnapshot = Schema.Struct({
  available: Schema.Boolean,
  readAt: Schema.String,
  staleAfterSeconds: NonNegativeInt,
  message: Schema.NullOr(TrimmedNonEmptyString),
  accounts: Schema.Array(QuotaAccount),
  instances: Schema.Array(QuotaInstanceBinding),
});
export type QuotaSnapshot = typeof QuotaSnapshot.Type;
