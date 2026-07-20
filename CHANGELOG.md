# Changelog

## 1.7.9

- Fix agentic-seo pre-crawl hanging on slow/unresponsive sites — fetches now time out after 10s instead of waiting indefinitely
- Fix AgentGrade/Vercel benchmarks throwing a raw JSON parse error when the underlying tool's output was truncated (usually by the 60s exec timeout) — now reports a clear "timed out" or "malformed JSON" reason instead
- Scan output now lists benchmarks that failed to run with their reason, and points to the issue tracker to report bugs

## 1.5.0

- Smart auto-fix engine — "Fix now?" actually fixes things
- Auto-creates agents.txt, sitemap.md, patches robots.txt for AI bots, scaffolds llms.txt
- Deduplicates overlapping failures across all 5 benchmarks into unified fix actions
- Prints actionable manual instructions for server-config and platform-specific issues
- Requires `--dir` for file-based fixes (won't blindly write to CWD)

## 1.4.1

- Fix false "afdocs failed" message — `afdocs check` exits 1 when it finds failures, which is expected

## 1.4.0

- Add Vercel Agent Readability benchmark (`@vercel/agent-readability`)
- Add AgentGrade benchmark (`agentgrade-cli`)
- Scan now runs 5 benchmarks in parallel: agentic-seo, Cloudflare, Fern, Vercel, AgentGrade

## 1.3.2

- Fix broken `afdocs` fix command — was calling `npx afdocs <url>` instead of `npx afdocs check <url>`
- Fix shell injection in `promptFix` — switched `execSync` to `execFileSync`
- Add test suite (`node --test`)
- Add GitHub Actions CI

## 1.3.1

- Add progress indicator during scan
- Add `history` command to view past scans
- Fix silent catch on corrupt history file — now warns instead of silently returning empty
- Fix error detail missing from `agentic-seo init` and `afdocs` failures
- Fix User-Agent from old "agent-web/1.0" to "aeo-ready/1.3"
- Add programmatic API docs to README
- Add `files` field to package.json — excludes dead dashboard code from npm (~12KB smaller)
- Add `repository`, `homepage`, `bugs` fields to package.json
- Add issue templates (bug report, feature request)
- Add CHANGELOG.md
- Link best-practices.md from README

## 1.3.0

- Terminal-only output, remove dashboard auto-open
- Interactive "Fix now?" prompt after scan
- Fetch site pages for agentic-seo instead of URL-only mode
- Add .aeo-ready/ to gitignore

## 1.2.0

- Rewrite as pure aggregator — removed proprietary scoring
- Interactive "Fix now?" prompt after scan runs `agentic-seo init` + `afdocs`
- Terminal-only output, removed dashboard auto-open

## 1.1.0

- Aggregator benchmarks: agentic-seo + Cloudflare + Fern in one scan
- Per-check detail with pass/fail and company comparisons
- `--dir` flag for local agentic-seo scanning (92 vs 23 in URL-only mode)
- `--json` and `--threshold` flags for CI
- Score history in `.aeo-ready/history.json`
- Dashboard generation (HTML)

## 1.0.0

- Initial release
- Unified AEO CLI with two scorecards, fix mode, dashboard
- `agent-web` skill for Claude Code
