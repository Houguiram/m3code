import { describe, expect, it } from "vite-plus/test";

import { parseCodexBarUsageJson } from "./codexBarUsage.ts";

const CODEX_ALL_ACCOUNTS = `
[
  {
    "account": "marin.godechot@gmail.com",
    "provider": "codex",
    "usage": {
      "accountEmail": "marin.godechot@gmail.com",
      "accountOrganization": "Personal",
      "identity": {
        "accountEmail": "marin.godechot@gmail.com",
        "accountOrganization": "Personal",
        "loginMethod": "prolite"
      },
      "loginMethod": "prolite",
      "primary": null,
      "secondary": {
        "resetsAt": "2026-09-07T09:01:16Z",
        "usedPercent": 71
      }
    }
  },
  {
    "account": "marin@firstconcepts.co — First Concepts",
    "provider": "codex",
    "usage": {
      "accountEmail": "marin@firstconcepts.co",
      "accountOrganization": "First Concepts",
      "loginMethod": "team",
      "primary": {
        "resetsAt": "2026-09-02T02:26:52Z",
        "usedPercent": 45
      },
      "secondary": {
        "resetsAt": "2026-09-08T16:21:33Z",
        "usedPercent": 23
      }
    }
  }
]
`;

describe("parseCodexBarUsageJson", () => {
  it("keeps both Codex accounts and distinct workspace keys", () => {
    const accounts = parseCodexBarUsageJson(CODEX_ALL_ACCOUNTS);
    expect(accounts.map((account) => account.key)).toEqual([
      "codex:marin.godechot@gmail.com|personal",
      "codex:marin@firstconcepts.co|first concepts",
    ]);
    expect(accounts[1]?.windows.map((window) => window.kind)).toEqual(["session", "weekly"]);
    expect(accounts[1]?.windows[0]?.remainingPercent).toBe(55);
  });

  it("skips provider error rows", () => {
    expect(
      parseCodexBarUsageJson(
        JSON.stringify([
          {
            provider: "claude",
            error: { message: "No token accounts configured for claude." },
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("parses a Claude row that has windows but no email", () => {
    const accounts = parseCodexBarUsageJson(
      JSON.stringify([
        {
          provider: "claude",
          usage: {
            identity: { providerID: "claude" },
            primary: { usedPercent: 0, resetsAt: "2026-09-02T03:09:00Z" },
            secondary: { usedPercent: 0, resetsAt: "2026-09-03T17:59:00Z" },
          },
        },
      ]),
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.email).toBeNull();
    expect(accounts[0]?.key).toBe("claude:label:claude");
  });
});
