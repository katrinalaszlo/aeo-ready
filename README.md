# aeo-ready

AEO benchmark aggregator. One scan, every score.

```bash
npx aeo-ready scan yoursite.com
```

## What it does

Runs every major AEO (Agentic Engine Optimization) benchmark against your site in one command. Shows per-check pass/fail, company comparisons, and tracks scores over time.

## Sources

| Benchmark | What it checks | Checks |
|-----------|---------------|--------|
| **agentic-seo** (Addy Osmani) | Discovery, content structure, token economics, capability signaling, UX bridge | 10 |
| **Cloudflare** (isitagentready.com) | Discoverability, content accessibility, bot access, API/MCP/A2A discovery, commerce | 19 |
| **Fern** (afdocs) | llms.txt quality, markdown availability, page size, content structure, URL stability, auth | 23 |
| **Vercel** (Agent Readability Spec) | Agent reachability, discoverability, markdown serving, HTML agent-friendliness | 25 |
| **AgentGrade** (agentgrade.com) | MCP, payment protocols, identity standards, content negotiation, OpenAPI, infrastructure | 70+ |

## Usage

```bash
npx aeo-ready scan yoursite.com
```

That's it — one command, no setup. Add flags only if you need them:

| Flag | What it does |
|------|--------------|
| `--dir ./public` | full scan (local + remote) — recommended, see below |
| `--json` | JSON output for CI |
| `--threshold 60` | exit 1 if score is below N |

### Why `--dir`?

agentic-seo scores ~23/100 in URL-only mode because most checks (content structure, token economics, capability signaling, UX bridge) need filesystem access. Pass `--dir` to your build output or public directory to get the real score.

```
URL-only:  agentic-seo 23/100 (F)
With --dir: agentic-seo 92/100 (A)
```

## Output

```
  aeo-ready — yoursite.com

  Checking agentic-seo · Cloudflare · Fern · Vercel · AgentGrade...

  agentic-seo ·································· 91/100 A
    ✓ Discovery              25/25
    ◑ Content Structure      18/25
    ✓ Token Economics        25/25
    ✓ Capability Signaling   15/15
    ✓ UX Bridge               8/10

  Cloudflare ···································· 4/5 B
    10 passed  2 failed
    ✗ robotsTxtAiRules  No rules for AI bots found
    ✗ contentSignals    No content signals in robots.txt

  Fern ········································ 83/100 B
    9 passed  4 failed
    ✗ llms-txt-links-markdown  Links point to HTML, no markdown
    ✗ content-start-position   2 pages have content past 50%
    ✗ llms-txt-coverage        Covers 67% of sitemap
    ✗ markdown-content-parity  4 pages have content differences

  Vercel ····································· 75/100 B
    15 passed  5 failed
    ✗ robots.txt               blocked: ccbot
    ✗ Agent UA → markdown      returned HTML
    ✗ .md URL → markdown       status 404
    ✗ Frontmatter              no frontmatter found
    ✗ Missing page → markdown  returned 404

  AgentGrade ································ 81/100 B+
    30 passed  10 failed
    ✗ llms.txt linked from HTML
    ✗ Accept: JSON returns JSON
    ✗ Accept: text returns text

  ──────────────────────────────────────────────────
  Overall                                     85/100

  Next steps
    npx afdocs check https://yoursite.com         4 Fern issues
    npx skills add katrinalaszlo/agent-serve      make your product agent-ready

  Fix now? [y/N]
```

Say `y` and aeo-ready analyzes failures across all 5 benchmarks, deduplicates overlapping issues, and fixes what it can:

- **Auto-fixes** (with `--dir`): patches robots.txt for AI bots, creates agents.txt, generates sitemap.md, scaffolds llms.txt/AGENTS.md, adds missing pages to llms.txt
- **Manual instructions**: prints actionable steps for server config (content negotiation, .md URLs, Vary header) and platform-specific issues

Non-interactive in CI (`--json` or non-TTY).

## CI Mode

```yaml
- run: npx aeo-ready scan yoursite.com --dir ./public --threshold 50
```

## History

Scores persist in `.aeo-ready/history.json`. Re-scan to track improvement over time.

```bash
npx aeo-ready history                          # show last 10 scans
```

## Programmatic API

```js
import { scan, getHistory } from "aeo-ready";

const result = await scan({ url: "https://yoursite.com", dir: "./public", json: true });
// result.averageScore, result.benchmarks.agenticSeo, .cloudflare, .fern, .vercel, .agentgrade

const history = getHistory(process.cwd());
// history.scans — array of past scan results
```

## Next step: make your product agent-ready

`aeo-ready` tells you how discoverable your site is to AI agents. To actually serve those agents — structured content, tool definitions, skill endpoints — use [agent-serve](https://github.com/katrinalaszlo/agent-serve):

```bash
npx skills add katrinalaszlo/agent-serve
```

## Best practices by site type

See [skills/agent-web/best-practices.md](skills/agent-web/best-practices.md) for an opinionated AEO framework covering SaaS, personal/portfolio, API/developer tools, and content/blog sites.

## Author

Kat Laszlo — [@katlaszlo](https://x.com/Katlaszlo)
