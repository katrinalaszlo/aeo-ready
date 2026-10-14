import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseScan } from "./cloudflare.js";

// The report isitagentready.com returned for composio.dev on 2026-10-13, shortened: the first two categories whole,
// one check of each remaining kind. The real one had 21 checks, 4 passing, Level 1/5.
const SCAN = `# Agent Readiness: https://composio.dev

**Level 1/5 -- Basic Web Presence**

## Discoverability (2/4 passing)
- PASS robotsTxt: robots.txt exists with valid format
- PASS sitemap: sitemap.xml exists with valid structure (url: https://composio.dev/sitemap.xml, from robots txt, format: xml)
- FAIL linkHeaders -- Include Link response headers for agent discovery (RFC 8288)
  No Link headers found on target page
  **Fix:** Add Link response headers to your homepage that point agents to useful resources. For example: Link: </.well-known/api-catalog>; rel="api-catalog" to advertise your API catalog.
  **Skill:** https://isitagentready.com/.well-known/agent-skills/link-headers/SKILL.md
  **Spec:** https://www.rfc-editor.org/rfc/rfc8288, https://www.rfc-editor.org/rfc/rfc9727#section-3
- FAIL dnsAid -- Publish DNS for AI Discovery (DNS-AID) SVCB/HTTPS records for DNS-based agent discovery
  DNS for AI Discovery (DNS-AID) well-known entrypoint records not found
  **Fix:** Publish DNS for AI Discovery (DNS-AID) records under your domain.
  **Spec:** https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/, https://www.rfc-editor.org/rfc/rfc9460

## Bot Access Control (1/2 passing)
- PASS robotsTxtAiRules: No AI-specific bot rules; wildcard rules apply to all crawlers including AI bots (targetPath: /, robotsStatus: ok)
- FAIL contentSignals -- Declare AI content usage preferences with Content Signals in robots.txt
  No Content Signals found in robots.txt
  **Fix:** Add Content-Signal directives to your robots.txt declaring preferences for ai-train, search, and ai-input. For example:
Content-Signal: ai-train=no, search=yes, ai-input=no
  **Skill:** https://isitagentready.com/.well-known/agent-skills/content-signals/SKILL.md
- OK webBotAuth: Web Bot Auth directory not found (informational only)

## Commerce (0/1 passing)
- FAIL x402 -- Support x402 protocol for agent-native HTTP payments
  x402 payment protocol not detected
  **Spec:** https://x402.org, https://github.com/coinbase/x402, https://docs.x402.org
`;

describe("Cloudflare scan parsing", () => {
  it("reads the level, every category and every check, failed ones included", () => {
    const r = parseScan(SCAN);
    assert.deepEqual([r.score, r.maxScore, r.grade, r.level], [1, 5, "F", 1]);
    assert.deepEqual(Object.keys(r.categories), ["discoverability", "bot-access-control", "commerce"]);
    assert.deepEqual(r.categories.discoverability, { name: "Discoverability", score: 2, maxScore: 4, percentage: 50 });
    assert.deepEqual(r.checks.map((c) => [c.status, c.id]), [
      ["pass", "robotsTxt"], ["pass", "sitemap"], ["fail", "linkHeaders"], ["fail", "dnsAid"],
      ["pass", "robotsTxtAiRules"], ["fail", "contentSignals"], ["ok", "webBotAuth"],
      ["fail", "x402"],
    ]);
    assert.equal(r.checks[2].message, "Include Link response headers for agent discovery (RFC 8288)");
    assert.equal(r.checks[0].message, "robots.txt exists with valid format");
    assert.equal(r.checks[6].message, "Web Bot Auth directory not found (informational only)");
    // The Fix, Skill and Spec lines under a failed check, indented or not, are not checks.
    assert.ok(r.checks.every((c) => !/Fix|Content-Signal/.test(c.id)));
  });

  it("a report with no level or checks reads as level 0", () => {
    assert.deepEqual(parseScan("nothing here"), { score: 0, maxScore: 5, grade: "F", level: 0, checks: [], categories: {} });
  });
});
