import chalk from "chalk";
import { execSync } from "child_process";
import { createInterface } from "readline";

const BENCHMARK_NAMES = {
  cloudflare: "Cloudflare",
  fern: "Fern",
  vercel: "Vercel",
  agentgrade: "AgentGrade",
};

const RECOMMENDATION_MAP = [
  {
    key: "robots-ai-rules",
    label: "Allow AI bots in robots.txt",
    detail:
      "Add User-agent / Allow rules for GPTBot, ClaudeBot, and other AI crawlers",
    match: (id) => /^robots\.txt$|robots.*blocked/i.test(id),
  },
  {
    key: "llms-txt",
    label: "Create and link llms.txt",
    detail:
      'Create llms.txt with site overview, then add <link rel="llms-txt" href="/llms.txt"> to your HTML <head>. Also add a <link rel="alternate" type="text/markdown"> on each page that has a markdown version.',
    match: (id) =>
      /llms-txt|llms.*linked|llms-full.*linked|llms.*coverage|markdown link alternate/i.test(
        id,
      ),
  },
  {
    key: "agents-txt",
    label: "Create agents.txt",
    detail:
      "Add an agents.txt file with agent permissions (User-agent / Allow rules)",
    match: (id) => /agents\.txt/i.test(id),
  },
  {
    key: "content-negotiation",
    label: "Support content negotiation",
    detail:
      "Return markdown when requests include Accept: text/markdown. Return the content type the client actually preferred, respecting order and q-values per RFC 9110. Add Vary: Accept header for caching.",
    match: (id) =>
      /content.negotiation|agent ua.*markdown|accept.*markdown|accept.*text.*returns|accept.*json.*returns|preferred content.type|^vary/i.test(
        id,
      ),
  },
  {
    key: "md-urls",
    label: "Serve markdown at .md URLs",
    detail:
      "Make pages available at .md extensions (e.g. /docs/page.md returns markdown). Missing pages should return markdown 404, not HTML.",
    match: (id) =>
      /markdown.url.support|\.md.*url.*markdown|\.md url|missing page.*markdown/i.test(
        id,
      ),
  },
  {
    key: "content-structure",
    label: "Improve content structure for agents",
    detail:
      "Move nav/chrome below main content so agents find content earlier. Add YAML frontmatter (title, description, date) to markdown pages.",
    match: (id) => /content.start.position|^frontmatter$/i.test(id),
  },
  {
    key: "markdown-parity",
    label: "Ensure markdown/HTML content parity",
    detail:
      "Markdown versions should match HTML content — check tabbed/accordion sections that may be missing",
    match: (id) => /markdown.content.parity/i.test(id),
  },
  {
    key: "sitemap-md",
    label: "Generate sitemap.md",
    detail:
      "Create a markdown sitemap alongside sitemap.xml for agent discovery",
    match: (id) => /^sitemap\.md$/i.test(id),
  },
  {
    key: "redirect",
    label: "Avoid cross-host redirects",
    detail:
      "AI agents may not follow redirects — serve content at the canonical URL",
    match: (id) => /redirect behavior/i.test(id),
  },
  {
    key: "json-ld",
    label: "Add Organization JSON-LD",
    detail: "Add structured data to <head> — see schema.org/Organization",
    match: (id) => /organization.*json.ld|json.ld.*organization/i.test(id),
  },
  {
    key: "identity",
    label: "Add identity and discovery protocols",
    detail:
      "Implement WebFinger, DID Document, A2A Agent Card, and/or WebMCP manifest for agent discovery",
    match: (id) =>
      /webfinger|did document|nostr|at protocol|agent card.*published|agent card.*verified|webmcp|apple app links|android asset links/i.test(
        id,
      ),
  },
  {
    key: "payment-info",
    label: "Declare payment information",
    detail:
      "Add x-payment-info header to paid API operations for agent billing awareness",
    match: (id) => /x-payment-info/i.test(id),
  },
  {
    key: "skill-md",
    label: "Add skill.md reference",
    detail:
      "Create a skill.md file describing your API's capabilities for agent consumption",
    match: (id) => /skill\.md/i.test(id),
  },
  {
    key: "rate-limits",
    label: "Return rate limit headers",
    detail:
      "Add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers to API responses",
    match: (id) => /rate limit/i.test(id),
  },
  {
    key: "signatures",
    label: "Publish signatures directory and public keys",
    detail:
      "Serve /.well-known/http-message-signatures-directory with agent identity and public keys (RFC 9421)",
    match: (id) =>
      /signatures directory|public keys|members declared/i.test(id),
  },
  {
    key: "form-annotations",
    label: "Add form tool annotations",
    detail:
      "Add tool-name and tool-description attributes to <form> elements for browser AI agents",
    match: (id) => /form tool annotations/i.test(id),
  },
  {
    key: "links-resolve",
    label: "Fix broken links in llms.txt",
    detail:
      "Some links in llms.txt point to pages that return errors or unexpected content types",
    match: (id) => /llms-txt-links/i.test(id),
  },
];

function collectFailedChecks(benchmarks) {
  const failed = [];
  for (const key of Object.keys(BENCHMARK_NAMES)) {
    const b = benchmarks[key];
    if (!b?.available || !b.checks) continue;
    for (const check of b.checks) {
      if (check.status === "fail" || check.status === "warn") {
        failed.push({ ...check, benchmark: key });
      }
    }
  }
  return failed;
}

function buildRecommendations(result) {
  const failed = collectFailedChecks(result.benchmarks);
  const groups = new Map();

  for (const check of failed) {
    let matched = false;
    for (const rec of RECOMMENDATION_MAP) {
      if (rec.match(check.id)) {
        if (!groups.has(rec.key)) {
          groups.set(rec.key, {
            key: rec.key,
            label: rec.label,
            detail: rec.detail,
            benchmarks: new Set(),
            checks: [],
          });
        }
        const g = groups.get(rec.key);
        g.benchmarks.add(check.benchmark);
        g.checks.push(check);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const fallbackKey = `other-${check.id}`;
      if (!groups.has(fallbackKey)) {
        groups.set(fallbackKey, {
          key: fallbackKey,
          label: check.label || check.id,
          detail: check.description || "",
          benchmarks: new Set(),
          checks: [],
        });
      }
      const g = groups.get(fallbackKey);
      g.benchmarks.add(check.benchmark);
      g.checks.push(check);
    }
  }

  const recs = [...groups.values()].map((g) => ({
    ...g,
    benchmarks: [...g.benchmarks],
    priority: g.benchmarks.size,
  }));

  recs.sort((a, b) => b.priority - a.priority);

  return recs;
}

function tierLabel(count) {
  if (count >= 3) return "High priority";
  if (count >= 2) return "Medium priority";
  return "Lower priority";
}

function tierDescription(count) {
  if (count >= 3) return "flagged by 3+ benchmarks";
  if (count >= 2) return "flagged by 2 benchmarks";
  return "flagged by 1 benchmark";
}

function generateAgentPrompt(result, recs) {
  const lines = [];
  lines.push(
    `My site ${result.url} scored ${result.averageScore}/100 on aeo-ready (AEO readiness scanner).`,
  );
  lines.push("Fix these issues to improve AI/agent discoverability.");
  lines.push(
    "Items are ordered by priority — issues flagged by multiple benchmarks matter most.",
  );
  lines.push(
    "This scan covers benchmarks across different site types (content sites, APIs, developer platforms).",
  );
  lines.push(
    "Not every recommendation may apply to this site — review each and prioritize accordingly.\n",
  );

  let currentTier = null;
  let num = 1;

  for (const rec of recs) {
    const tier = tierLabel(rec.priority);
    if (tier !== currentTier) {
      currentTier = tier;
      lines.push(`## ${tier} (${tierDescription(rec.priority)})`);
    }
    const benchmarkList = rec.benchmarks
      .map((b) => BENCHMARK_NAMES[b])
      .join(", ");
    lines.push(`${num}. ${rec.label} [${benchmarkList}]`);
    if (rec.detail) {
      lines.push(`   ${rec.detail}`);
    }
    num++;
  }

  lines.push("");
  lines.push("## Instructions");
  lines.push(
    "- Fix what you can programmatically. For each fix, explain what you changed.",
  );
  lines.push(
    "- For anything that requires infrastructure or configuration changes you can't make,",
  );
  lines.push(
    "  list it separately with clear step-by-step instructions I can follow manually.",
  );
  lines.push("");
  lines.push(`Re-scan after: npx aeo-ready scan ${result.url}`);

  return lines.join("\n");
}

function copyToClipboard(text) {
  try {
    execSync("pbcopy", { input: text, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    try {
      execSync("xclip -selection clipboard", {
        input: text,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      try {
        execSync("xsel --clipboard --input", {
          input: text,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return true;
      } catch {
        return false;
      }
    }
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function showRecommendations(result) {
  const recs = buildRecommendations(result);
  if (recs.length === 0) return;

  const highCount = recs.filter((r) => r.priority >= 3).length;
  const summary =
    highCount > 0
      ? `${recs.length} recommendations (${highCount} high priority)`
      : `${recs.length} recommendations`;

  const prompt = generateAgentPrompt(result, recs);

  if (!process.stdin.isTTY) {
    console.log(`\n${prompt}\n`);
    return;
  }

  console.log(`\n  ${chalk.bold(summary)}\n`);

  const optStr = [
    ["v", "View prompt"],
    ["c", "Copy prompt"],
    ["q", "Done"],
  ]
    .map(([key, label]) => `${chalk.bold(`[${key}]`)} ${label}`)
    .join("  ");

  while (true) {
    const answer = await ask(`  ${optStr} `);

    if (answer === "v") {
      console.log("");
      console.log(
        prompt
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
      );
      console.log("");
    } else if (answer === "c") {
      const copied = copyToClipboard(prompt);
      if (copied) {
        console.log(chalk.green("\n  Copied to clipboard.\n"));
      } else {
        console.log(chalk.dim("\n  Could not copy to clipboard.\n"));
      }
      break;
    } else {
      break;
    }
  }
}
