import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "CCBot",
  "PerplexityBot",
  "Meta-ExternalAgent",
];

const FIX_ACTIONS = [
  {
    key: "robots-ai-rules",
    label: "Add AI bot rules to robots.txt",
    auto: true,
    match: (id) => /^robots\.txt$|robots.*blocked/i.test(id),
    apply: patchRobotsTxt,
  },
  {
    key: "llms-txt-bootstrap",
    label: "Scaffold llms.txt and AGENTS.md",
    auto: true,
    match: () => false,
    apply: bootstrapLlmsTxt,
  },
  {
    key: "agents-txt",
    label: "Create agents.txt",
    auto: true,
    match: (id) => /agents\.txt/i.test(id),
    apply: createAgentsTxt,
  },
  {
    key: "sitemap-md",
    label: "Generate sitemap.md from sitemap.xml",
    auto: true,
    match: (id) => /^sitemap\.md$/i.test(id),
    apply: generateSitemapMd,
  },
  {
    key: "llms-txt-coverage",
    label: "Add missing pages to llms.txt",
    auto: true,
    match: (id) => id === "llms-txt-coverage",
    apply: patchLlmsTxtCoverage,
  },
  {
    key: "llms-txt-directive",
    label:
      'Add <link rel="llms-txt" href="/llms.txt"> to your HTML <head> template',
    auto: false,
    match: (id) =>
      /llms-txt-directive|llms.*linked.*html|llms-full.*linked/i.test(id),
  },
  {
    key: "content-negotiation",
    label:
      "Configure server to return markdown for Accept: text/markdown requests",
    auto: false,
    match: (id) =>
      /content.negotiation|agent ua.*markdown|accept.*markdown|accept.*text.*returns|accept.*json.*returns|preferred content.type/i.test(
        id,
      ),
  },
  {
    key: "md-url-support",
    label: "Serve markdown at .md URLs (e.g. /docs/page.md)",
    auto: false,
    match: (id) => /markdown.url.support|\.md.*url.*markdown/i.test(id),
  },
  {
    key: "vary-header",
    label: "Add Vary: Accept response header for content negotiation caching",
    auto: false,
    match: (id) => /^vary/i.test(id),
  },
  {
    key: "content-start",
    label: "Move nav/chrome below main content so agents find content earlier",
    auto: false,
    match: (id) => /content.start.position/i.test(id),
  },
  {
    key: "markdown-parity",
    label:
      "Ensure markdown versions match HTML content (check tabbed/accordion sections)",
    auto: false,
    match: (id) => /markdown.content.parity/i.test(id),
  },
  {
    key: "redirect",
    label: "Avoid cross-host redirects — agents may not follow them",
    auto: false,
    match: (id) => /redirect behavior/i.test(id),
  },
  {
    key: "json-ld",
    label: "Add Organization JSON-LD to <head> — see schema.org/Organization",
    auto: false,
    match: (id) => /organization.*json.ld|json.ld.*organization/i.test(id),
  },
  {
    key: "identity",
    label:
      "Identity protocols (WebFinger, DID, A2A Agent Card) — see agentgrade.com",
    auto: false,
    match: (id) =>
      /webfinger|did document|nostr|at protocol|agent card|webmcp/i.test(id),
  },
];

function collectFailedChecks(benchmarks) {
  const failed = [];
  for (const key of ["cloudflare", "fern", "vercel", "agentgrade"]) {
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

function dedup(failedChecks) {
  const triggered = new Map();
  for (const check of failedChecks) {
    for (const action of FIX_ACTIONS) {
      if (triggered.has(action.key)) continue;
      if (action.match(check.id)) {
        triggered.set(action.key, action);
        break;
      }
    }
  }
  return triggered;
}

export async function runFixes(result, dir) {
  const failed = collectFailedChecks(result.benchmarks);
  if (failed.length === 0) {
    console.log(chalk.green("\n  All checks passed!\n"));
    return;
  }

  const triggered = dedup(failed);

  if (!triggered.has("llms-txt-bootstrap") && dir) {
    const llms = join(dir, "llms.txt");
    const agents = join(dir, "AGENTS.md");
    if (!existsSync(llms) || !existsSync(agents)) {
      triggered.set("llms-txt-bootstrap", FIX_ACTIONS[1]);
    }
  }

  const fixed = [];
  const manual = [];

  for (const [, action] of triggered) {
    if (!action.auto) {
      manual.push(action.label);
      continue;
    }
    const r = await action.apply(dir, result);
    if (r) fixed.push(r);
  }

  console.log("");
  if (fixed.length > 0) {
    console.log(
      chalk.bold(
        `  Fixed ${fixed.length} issue${fixed.length > 1 ? "s" : ""}:\n`,
      ),
    );
    for (const f of fixed) {
      console.log(`    ${chalk.green("✓")} ${f}`);
    }
    console.log("");
  }

  if (manual.length > 0) {
    console.log(chalk.bold("  Manual fixes needed:\n"));
    manual.forEach((m, i) => {
      console.log(`    ${chalk.dim(`${i + 1}.`)} ${m}`);
    });
    console.log("");
  }

  const rescan = `npx aeo-ready scan ${result.url}${dir ? ` --dir ${dir}` : ""}`;
  if (fixed.length > 0) {
    console.log(chalk.dim("  Deploy, then re-scan: ") + rescan + "\n");
  } else {
    console.log(chalk.dim("  Re-scan to verify: ") + rescan + "\n");
  }
}

function patchRobotsTxt(dir) {
  const file = join(dir, "robots.txt");
  let content = "";
  if (existsSync(file)) {
    content = readFileSync(file, "utf8");
  }

  const missing = AI_BOTS.filter(
    (bot) => !content.toLowerCase().includes(bot.toLowerCase()),
  );
  if (missing.length === 0) return null;

  const block = missing
    .map((bot) => `User-agent: ${bot}\nAllow: /`)
    .join("\n\n");
  const sep =
    content.length > 0 && !content.endsWith("\n")
      ? "\n\n"
      : content.length > 0
        ? "\n"
        : "";
  writeFileSync(file, content + sep + block + "\n");
  return `Added ${missing.length} AI bot rules to robots.txt`;
}

function bootstrapLlmsTxt(dir) {
  const llms = join(dir, "llms.txt");
  const agents = join(dir, "AGENTS.md");
  if (existsSync(llms) && existsSync(agents)) return null;

  try {
    execFileSync("npx", ["agentic-seo", "init", dir], {
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return "Scaffolded llms.txt and AGENTS.md via agentic-seo";
  } catch (err) {
    console.log(
      chalk.red(`    agentic-seo init failed: ${err.message?.slice(0, 80)}`),
    );
    return null;
  }
}

function createAgentsTxt(dir) {
  const file = join(dir, "agents.txt");
  if (existsSync(file)) return null;

  writeFileSync(file, "# agents.txt\nUser-agent: *\nAllow: /\n");
  return "Created agents.txt with default permissions";
}

function generateSitemapMd(dir) {
  const file = join(dir, "sitemap.md");
  if (existsSync(file)) return null;

  const xmlFile = join(dir, "sitemap.xml");
  if (!existsSync(xmlFile)) return null;

  const xml = readFileSync(xmlFile, "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) return null;

  const lines = ["# Sitemap\n", ...urls.map((u) => `- [${u}](${u})`)];
  writeFileSync(file, lines.join("\n") + "\n");
  return `Generated sitemap.md with ${urls.length} URLs`;
}

function patchLlmsTxtCoverage(dir, result) {
  const llmsFile = join(dir, "llms.txt");
  const xmlFile = join(dir, "sitemap.xml");
  if (!existsSync(llmsFile) || !existsSync(xmlFile)) return null;

  const llms = readFileSync(llmsFile, "utf8");
  const xml = readFileSync(xmlFile, "utf8");
  const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1],
  );

  const missing = sitemapUrls.filter((u) => !llms.includes(u));
  if (missing.length === 0) return null;

  const block =
    "\n## Additional Pages\n\n" +
    missing.map((u) => `- [${u}](${u})`).join("\n");
  writeFileSync(llmsFile, llms.trimEnd() + "\n" + block + "\n");
  return `Added ${missing.length} missing pages to llms.txt`;
}
