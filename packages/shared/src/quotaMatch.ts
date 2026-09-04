/**
 * Join CodexBar quota accounts onto M3 provider instances.
 *
 * Automatic matching is email (plus organization when two rows share an
 * email). A stored `codexBarAccount` pin always wins. Same-driver sole
 * account/instance pairs bind when no email is available (Claude often
 * omits identity).
 *
 * @module quotaMatch
 */
import type {
  ProviderDriverKind,
  ProviderInstanceId,
  QuotaAccount,
  QuotaInstanceBinding,
  QuotaMatchKind,
  QuotaProviderKind,
} from "@t3tools/contracts";

export interface QuotaInstanceCandidate {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly email?: string | undefined;
  readonly pin?: string | undefined;
}

export function normalizeQuotaIdentity(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function quotaProviderForDriver(driver: string): QuotaProviderKind | null {
  if (driver === "codex") return "codex";
  if (driver === "claudeAgent") return "claude";
  if (driver === "cursor") return "cursor";
  return null;
}

export function quotaAccountKey(input: {
  readonly provider: QuotaProviderKind;
  readonly email?: string | null | undefined;
  readonly organization?: string | null | undefined;
  readonly label?: string | null | undefined;
}): string {
  const email = normalizeQuotaIdentity(input.email);
  const organization = normalizeQuotaIdentity(input.organization);
  if (email.length > 0 && organization.length > 0) {
    return `${input.provider}:${email}|${organization}`;
  }
  if (email.length > 0) {
    return `${input.provider}:${email}`;
  }
  const label = normalizeQuotaIdentity(input.label);
  if (label.length > 0) {
    return `${input.provider}:label:${label}`;
  }
  return `${input.provider}:anonymous`;
}

export function quotaAccountLabel(
  account: Pick<QuotaAccount, "email" | "organization" | "label">,
): string {
  const email = account.email?.trim() ?? "";
  const organization = account.organization?.trim() ?? "";
  if (email.length > 0 && organization.length > 0) {
    return `${email} — ${organization}`;
  }
  if (email.length > 0) return email;
  return account.label;
}

function accountMatchesPin(account: QuotaAccount, pin: string): boolean {
  const normalizedPin = normalizeQuotaIdentity(pin);
  if (normalizedPin.length === 0) return false;
  return (
    account.key === pin ||
    normalizeQuotaIdentity(account.key) === normalizedPin ||
    normalizeQuotaIdentity(account.email) === normalizedPin ||
    normalizeQuotaIdentity(account.label) === normalizedPin ||
    normalizeQuotaIdentity(quotaAccountLabel(account)) === normalizedPin
  );
}

function bindOne(
  instance: QuotaInstanceCandidate,
  accounts: readonly QuotaAccount[],
): QuotaInstanceBinding {
  const provider = quotaProviderForDriver(instance.driver);
  const providerAccounts =
    provider === null ? [] : accounts.filter((account) => account.provider === provider);

  const pin = instance.pin?.trim();
  if (pin !== undefined && pin.length > 0) {
    const pinned = providerAccounts.filter((account) => accountMatchesPin(account, pin));
    return finish(
      instance,
      pinned.length === 1 ? pinned[0]! : null,
      pinned.length > 1 ? "ambiguous" : "manual",
    );
  }

  const email = normalizeQuotaIdentity(instance.email);
  if (email.length > 0) {
    const byEmail = providerAccounts.filter(
      (account) => normalizeQuotaIdentity(account.email) === email,
    );
    if (byEmail.length === 1) {
      return finish(instance, byEmail[0]!, "email");
    }
    if (byEmail.length > 1) {
      return finish(instance, null, "ambiguous");
    }
    return finish(instance, null, "unmatched");
  }

  return finish(instance, null, "unmatched");
}

function finish(
  instance: QuotaInstanceCandidate,
  account: QuotaAccount | null,
  match: QuotaMatchKind,
): QuotaInstanceBinding {
  if (match === "manual" && account === null) {
    return {
      instanceId: instance.instanceId,
      driver: instance.driver,
      match: "unmatched",
      account: null,
    };
  }
  return {
    instanceId: instance.instanceId,
    driver: instance.driver,
    match,
    account,
  };
}

/**
 * Bind every instance. Sole-instance fallback runs after the first pass so
 * two Claude instances cannot both claim the one Claude CodexBar row.
 */
export function bindQuotaInstances(
  instances: readonly QuotaInstanceCandidate[],
  accounts: readonly QuotaAccount[],
): readonly QuotaInstanceBinding[] {
  const firstPass = instances.map((instance) => bindOne(instance, accounts));
  const claimedKeys = new Set(
    firstPass.flatMap((binding) => (binding.account === null ? [] : [binding.account.key])),
  );

  return firstPass.map((binding, index) => {
    if (binding.account !== null || binding.match === "ambiguous") {
      return binding;
    }
    const instance = instances[index]!;
    // Email already disagreed with every CodexBar row. Do not sole-bind a
    // leftover account onto a known-different identity (Cursor especially).
    if (normalizeQuotaIdentity(instance.email).length > 0) {
      return binding;
    }
    const provider = quotaProviderForDriver(instance.driver);
    if (provider === null) return binding;

    const sameDriverInstances = instances.filter(
      (candidate) => quotaProviderForDriver(candidate.driver) === provider,
    );
    const unmatchedSameDriver = firstPass.filter(
      (candidate, candidateIndex) =>
        quotaProviderForDriver(instances[candidateIndex]!.driver) === provider &&
        candidate.account === null &&
        candidate.match !== "ambiguous",
    );
    const remainingAccounts = accounts.filter(
      (account) => account.provider === provider && !claimedKeys.has(account.key),
    );

    if (
      sameDriverInstances.length === 1 &&
      unmatchedSameDriver.length === 1 &&
      remainingAccounts.length === 1
    ) {
      const account = remainingAccounts[0]!;
      claimedKeys.add(account.key);
      return {
        instanceId: binding.instanceId,
        driver: binding.driver,
        match: "sole",
        account,
      };
    }

    return binding;
  });
}
