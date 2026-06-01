import chalk from "chalk";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { runFixes } from "./fix.js";

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
      'Create llms.txt with site overview, then add <link rel="llms-txt" href="/llms.txt"> to your HTML <head>',
    match: (id) =>
      /llms-txt|llms.*linked|llms-full.*linked|llms.*coverage/i.test(id),
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
      "Return markdown when requests include Accept: text/markdown. Add Vary: Accept header for proper caching.",
    match: (id) =>
      /content.negotiation|agent ua.*markdown|accept.*markdown|accept.*text.*returns|accept.*json.*returns|preferred content.type|^vary/i.test(
        id,
      ),
  },
  {
    key: "md-urls",
    label: "Serve markdown at .md URLs",
    detail:
      "Make pages available at .md extensions (e.g. /docs/page.md returns markdown)",
    match: (id) =>
      /markdown.url.support|\.md.*url.*markdown|\.md url/i.test(id),
  },
  {
    key: "content-structure",
    label: "Improve content structure for agents",
    detail:
      "Move nav/chrome below main content so agents find content earlier. Add frontmatter to markdown pages.",
    match: (id) => /content.start.position|frontmatter/i.test(id),
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
      /webfinger|did document|nostr|at protocol|agent card|webmcp|apple app links|android asset links/i.test(
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
    label: "Publish signatures directory",
    detail:
      "Serve /.well-known/http-message-signatures-directory for request verification",
    match: (id) => /signatures directory|public keys/i.test(id),
  },
  {
    key: "members",
    label: "Declare team members",
    detail: "Add a members array to your signatures directory or agent card",
    match: (id) => /members declared/i.test(id),
  },
  {
    key: "form-annotations",
    label: "Add form tool annotations",
    detail:
      "Add tool-name and tool-description attributes to forms for agent understanding",
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

function printRecommendations(recs) {
  let currentTier = null;
  let num = 1;

  console.log("");
  for (const rec of recs) {
    const tier = tierLabel(rec.priority);
    if (tier !== currentTier) {
      currentTier = tier;
      const color =
        rec.priority >= 3
          ? chalk.red
          : rec.priority >= 2
            ? chalk.yellow
            : chalk.dim;
      console.log(
        `  ${color.bold(tier)} ${chalk.dim(`(${tierDescription(rec.priority)})`)}`,
      );
    }
    const benchmarkList = rec.benchmarks
      .map((b) => BENCHMARK_NAMES[b])
      .join(" · ");
    console.log(`    ${chalk.dim(`${num}.`)} ${rec.label}`);
    console.log(`       ${chalk.dim(benchmarkList)}`);
    num++;
  }
  console.log("");
}

function generateAgentPrompt(result, recs) {
  const lines = [];
  lines.push(
    `My site ${result.url} scored ${result.averageScore}/100 on aeo-ready (AEO readiness scanner).`,
  );
  lines.push(`Fix these issues to improve AI/agent discoverability:\n`);

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
  lines.push(
    "For any issues that can't be fixed programmatically, outline them for me",
  );
  lines.push(
    "with clear step-by-step instructions on how to address them manually.",
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

function detectLocalProject(dir) {
  if (dir) return dir;
  const cwd = process.cwd();
  const indicators = [
    "package.json",
    "index.html",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "nuxt.config.ts",
    "astro.config.mjs",
    "vite.config.ts",
    "vite.config.js",
    "gatsby-config.js",
    "angular.json",
    "svelte.config.js",
    "remix.config.js",
    "public",
  ];
  for (const f of indicators) {
    if (existsSync(join(cwd, f))) return cwd;
  }
  return null;
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

export async function showRecommendations(result, dir) {
  const recs = buildRecommendations(result);
  if (recs.length === 0) return;

  const highCount = recs.filter((r) => r.priority >= 3).length;
  const summary =
    highCount > 0
      ? `${recs.length} recommendations (${highCount} high priority)`
      : `${recs.length} recommendations`;

  console.log(`\n  ${chalk.bold(summary)}\n`);

  const localDir = detectLocalProject(dir);

  const options = [];
  options.push(["v", "View recommendations"]);
  options.push(["c", "Copy prompt for AI agent"]);
  if (localDir) {
    options.push(["f", "Fix now"]);
  }
  options.push(["q", "Done"]);

  const optStr = options
    .map(([key, label]) => `${chalk.bold(`[${key}]`)} ${label}`)
    .join("  ");

  while (true) {
    const answer = await ask(`  ${optStr} `);

    if (answer === "v") {
      printRecommendations(recs);
    } else if (answer === "c") {
      const prompt = generateAgentPrompt(result, recs);
      const copied = copyToClipboard(prompt);
      if (copied) {
        console.log(chalk.green("\n  Copied to clipboard.\n"));
      } else {
        console.log(
          chalk.dim("\n  Could not copy — here are the instructions:\n"),
        );
        console.log(prompt);
        console.log("");
      }
    } else if (answer === "f" && localDir) {
      await runFixes(result, localDir);
      break;
    } else {
      break;
    }
  }
}
