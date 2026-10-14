import chalk from "chalk";
import { runBenchmark as runAgenticSeo } from "./agentic-seo.js";
import { runCloudflare } from "./cloudflare.js";
import { runFern } from "./fern.js";
import { runVercel } from "./vercel.js";
import { runAgentgrade } from "./agentgrade.js";

const W = 52;
const ISSUES_URL = "https://github.com/katrinalaszlo/aeo-ready/issues";
const BENCHMARK_NAMES = {
  agenticSeo: "agentic-seo",
  cloudflare: "Cloudflare",
  fern: "Fern",
  vercel: "Vercel",
  agentgrade: "AgentGrade",
};

// A benchmark that has not answered by then is reported as not available, so the JSON document still prints with
// the others. agent-ready kills a scan at 900s; this stays under that.
export const BENCHMARK_TIMEOUT_MS = 720_000;

export async function runAllBenchmarks(
  target,
  dir,
  onProgress,
  timeoutMs = BENCHMARK_TIMEOUT_MS,
) {
  const isUrl = target && target.startsWith("http");
  const settle = (name, run) =>
    settleBenchmark(name, run, onProgress, timeoutMs);

  const [agenticSeo, cloudflare, fern, vercel, agentgrade] = await Promise.all([
    settle("agentic-seo", () => runAgenticSeo(dir || target)),
    isUrl ? settle("Cloudflare", () => runCloudflare(target)) : null,
    isUrl ? settle("Fern", () => runFern(target)) : null,
    isUrl ? settle("Vercel", () => runVercel(target)) : null,
    isUrl ? settle("AgentGrade", () => runAgentgrade(target)) : null,
  ]);

  return { agenticSeo, cloudflare, fern, vercel, agentgrade };
}

// Never rejects. A benchmark that throws, or that has not settled when the deadline fires, becomes
// { available: false, reason }. The deadline timer keeps the process alive while a benchmark hangs with no open
// handle; without it Node exits 0 the moment the event loop empties, before the scan ever prints its JSON.
// durationMs is wall-clock time from the benchmark's start; benchmarks run in parallel, so they overlap.
export async function settleBenchmark(name, run, onProgress, timeoutMs) {
  const start = Date.now();
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          available: false,
          reason: `did not finish within ${Math.round(timeoutMs / 1000)}s`,
        }),
      timeoutMs,
    );
  });
  let result;
  try {
    result = await Promise.race([run(), deadline]);
  } catch (err) {
    result = { available: false, reason: err.message?.slice(0, 100) };
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Date.now() - start;
  if (onProgress) onProgress(name, result.available === true, durationMs);
  return { ...result, durationMs };
}

export function printBenchmarks(benchmarks) {
  const any = Object.values(benchmarks).some((b) => b && b.available);

  if (any) {
    console.log("");

    if (benchmarks.agenticSeo?.available) {
      printBenchmarkBlock("agentic-seo", "agenticSeo", benchmarks.agenticSeo);
    }
    if (benchmarks.cloudflare?.available) {
      printBenchmarkBlock("Cloudflare", "cloudflare", benchmarks.cloudflare);
    }
    if (benchmarks.fern?.available) {
      printBenchmarkBlock("Fern", "fern", benchmarks.fern);
    }
    if (benchmarks.vercel?.available) {
      printBenchmarkBlock("Vercel", "vercel", benchmarks.vercel);
    }
    if (benchmarks.agentgrade?.available) {
      printBenchmarkBlock("AgentGrade", "agentgrade", benchmarks.agentgrade);
    }
  }

  printFailures(benchmarks);
}

function printFailures(benchmarks) {
  const failed = Object.entries(benchmarks).filter(
    ([, b]) => b && b.available === false,
  );
  if (failed.length === 0) return;

  console.log(
    chalk.dim(
      `  ${failed.length} benchmark${failed.length > 1 ? "s" : ""} failed to run:`,
    ),
  );
  for (const [key, b] of failed) {
    const name = BENCHMARK_NAMES[key] || key;
    console.log(chalk.dim(`    ${name} — ${b.reason || "unknown error"}`));
  }
  console.log(
    chalk.dim("  Think this is a bug? Open an issue: ") + chalk.dim(ISSUES_URL),
  );
  console.log("");
}

function scoreColor(pct) {
  return pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
}

function truncateMessage(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function printBenchmarkBlock(name, key, b) {
  const pct = b.maxScore > 0 ? Math.round((b.score / b.maxScore) * 100) : 0;
  const color = scoreColor(pct);
  const scoreStr = `${b.score}/${b.maxScore}`;
  const gradeStr = b.grade ? ` ${b.grade}` : "";
  const right = `${scoreStr}${gradeStr}`;
  const dots = W - name.length - right.length;
  const leader = dots > 2 ? " " + chalk.dim("·".repeat(dots - 2)) + " " : " ";

  console.log(`  ${chalk.bold(name)}${leader}${color(right)}`);

  if (b.checks && b.checks.length > 0) {
    const passed = b.checks.filter((c) => c.status === "pass");
    const failed = b.checks.filter(
      (c) => c.status === "fail" || c.status === "warn",
    );

    if (passed.length > 0 && failed.length > 0) {
      console.log(
        chalk.dim(
          `    ${chalk.green(passed.length + " passed")}  ${chalk.red(failed.length + " failed")}`,
        ),
      );
    } else if (passed.length > 0) {
      console.log(chalk.dim(`    ${chalk.green(passed.length + " passed")}`));
    }

    const termWidth = process.stdout.columns || 80;
    for (const check of failed) {
      const prefix = `    ✗ ${check.id} `;
      const budget = Math.max(20, termWidth - prefix.length);
      const msg = check.message
        ? chalk.dim(` ${truncateMessage(check.message, budget)}`)
        : "";
      console.log(`    ${chalk.red("✗")} ${check.id}${msg}`);
    }
  } else if (b.categories) {
    for (const [, cat] of Object.entries(b.categories)) {
      const catPct =
        cat.percentage ??
        (cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0);
      const icon =
        catPct >= 80
          ? chalk.green("✓")
          : catPct >= 40
            ? chalk.yellow("◑")
            : chalk.red("✗");
      console.log(
        `    ${icon} ${chalk.dim((cat.name || "").padEnd(22))} ${chalk.dim(`${cat.score}/${cat.maxScore}`)}`,
      );
    }
  }

  console.log("");
}
