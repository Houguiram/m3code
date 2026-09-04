# Review usage

The Usage page combines Codex, Claude Code, and Grok Build activity from your connected
environments. It reads the providers' local session history and shows API-equivalent token cost,
processed tokens, cache savings, provider shares, and model breakdowns. Subscription billing is
separate from the raw token cost shown here.

When the CodexBar CLI is installed on the environment, the page also shows remaining session and
weekly limits for Claude, Codex, and Cursor. Those numbers come from your provider accounts, not
from local token totals. Multiple accounts for the same provider are matched by email; if two
CodexBar rows share an email, pin the right account on the provider in Settings.

Grok Build totals come from persisted session updates. Interactive turns that never wrote a
completed-turn record will not appear.

Use **Past 24h** for an hourly chart covering the exact rolling 24-hour period. The **7 days**,
**30 days**, and **90 days** ranges use daily resolution. Cost and token toggles update both the
headline and chart, and refreshing rescans every connected environment.
