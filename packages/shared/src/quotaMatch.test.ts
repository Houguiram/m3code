import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId, type QuotaAccount } from "@t3tools/contracts";

import {
  bindQuotaInstances,
  quotaAccountKey,
  quotaAccountLabel,
  quotaProviderForDriver,
} from "./quotaMatch.ts";

const workId = ProviderInstanceId.make("codex_work");
const personalId = ProviderInstanceId.make("codex_personal");
const claudeId = ProviderInstanceId.make("claudeAgent");
const cursorId = ProviderInstanceId.make("cursor");
const codex = ProviderDriverKind.make("codex");
const claude = ProviderDriverKind.make("claudeAgent");
const cursor = ProviderDriverKind.make("cursor");

function account(input: {
  readonly provider: QuotaAccount["provider"];
  readonly email?: string | null;
  readonly organization?: string | null;
  readonly label?: string;
}): QuotaAccount {
  const label =
    input.label ??
    quotaAccountLabel({
      email: input.email ?? null,
      organization: input.organization ?? null,
      label: "unused",
    });
  return {
    key: quotaAccountKey({
      provider: input.provider,
      email: input.email,
      organization: input.organization,
      label,
    }),
    provider: input.provider,
    label,
    email: input.email ?? null,
    organization: input.organization ?? null,
    plan: null,
    windows: [],
  };
}

describe("quotaAccountKey", () => {
  it("prefers email plus organization so two workspaces stay distinct", () => {
    expect(
      quotaAccountKey({
        provider: "codex",
        email: "marin@firstconcepts.co",
        organization: "First Concepts",
      }),
    ).toBe("codex:marin@firstconcepts.co|first concepts");
  });
});

describe("quotaProviderForDriver", () => {
  it("maps Claude's M3 driver slug onto CodexBar's provider id", () => {
    expect(quotaProviderForDriver("claudeAgent")).toBe("claude");
    expect(quotaProviderForDriver("grok")).toBeNull();
  });
});

describe("bindQuotaInstances", () => {
  const work = account({
    provider: "codex",
    email: "marin@firstconcepts.co",
    organization: "First Concepts",
  });
  const personal = account({
    provider: "codex",
    email: "marin.godechot@gmail.com",
    organization: "Personal",
  });

  it("matches distinct emails automatically", () => {
    expect(
      bindQuotaInstances(
        [
          {
            instanceId: workId,
            driver: codex,
            email: "marin@firstconcepts.co",
          },
          {
            instanceId: personalId,
            driver: codex,
            email: "marin.godechot@gmail.com",
          },
        ],
        [work, personal],
      ),
    ).toEqual([
      { instanceId: workId, driver: codex, match: "email", account: work },
      { instanceId: personalId, driver: codex, match: "email", account: personal },
    ]);
  });

  it("does not guess when two CodexBar rows share an email", () => {
    const team = account({
      provider: "codex",
      email: "shared@example.com",
      organization: "Team",
    });
    const plus = account({
      provider: "codex",
      email: "shared@example.com",
      organization: "Personal",
    });
    expect(
      bindQuotaInstances(
        [{ instanceId: workId, driver: codex, email: "shared@example.com" }],
        [team, plus],
      ),
    ).toEqual([{ instanceId: workId, driver: codex, match: "ambiguous", account: null }]);
  });

  it("lets a manual pin pick the workspace when email is ambiguous", () => {
    const team = account({
      provider: "codex",
      email: "shared@example.com",
      organization: "Team",
    });
    const plus = account({
      provider: "codex",
      email: "shared@example.com",
      organization: "Personal",
    });
    expect(
      bindQuotaInstances(
        [
          {
            instanceId: workId,
            driver: codex,
            email: "shared@example.com",
            pin: team.key,
          },
        ],
        [team, plus],
      ),
    ).toEqual([{ instanceId: workId, driver: codex, match: "manual", account: team }]);
  });

  it("binds a pin by CodexBar account label", () => {
    expect(
      bindQuotaInstances(
        [
          {
            instanceId: workId,
            driver: codex,
            pin: "marin@firstconcepts.co — First Concepts",
          },
        ],
        [work, personal],
      ),
    ).toEqual([{ instanceId: workId, driver: codex, match: "manual", account: work }]);
  });

  it("falls back to the sole same-driver account when Claude has no email", () => {
    const claudeAccount = account({ provider: "claude", label: "Claude" });
    expect(
      bindQuotaInstances([{ instanceId: claudeId, driver: claude }], [claudeAccount, work]),
    ).toEqual([{ instanceId: claudeId, driver: claude, match: "sole", account: claudeAccount }]);
  });

  it("does not sole-bind when two Claude instances would share one row", () => {
    const claudeAccount = account({ provider: "claude", label: "Claude" });
    const otherClaude = ProviderInstanceId.make("claude_personal");
    expect(
      bindQuotaInstances(
        [
          { instanceId: claudeId, driver: claude },
          { instanceId: otherClaude, driver: claude },
        ],
        [claudeAccount],
      ),
    ).toEqual([
      { instanceId: claudeId, driver: claude, match: "unmatched", account: null },
      { instanceId: otherClaude, driver: claude, match: "unmatched", account: null },
    ]);
  });

  it("leaves Cursor unmatched when emails differ", () => {
    const cursorAccount = account({
      provider: "cursor",
      email: "marin@firstconcepts.co",
    });
    expect(
      bindQuotaInstances(
        [{ instanceId: cursorId, driver: cursor, email: "other@example.com" }],
        [cursorAccount],
      ),
    ).toEqual([{ instanceId: cursorId, driver: cursor, match: "unmatched", account: null }]);
  });
});
