import chalk from "chalk";
import { runBenchmark as runAgenticSeo } from "./agentic-seo.js";
import { runCloudflare } from "./cloudflare.js";
import { runFern } from "./fern.js";
import { runVercel } from "./vercel.js";
import { runAgentgrade } from "./agentgrade.js";

const W = 52;

export async function runAllBenchmarks(target, dir) {
  const isUrl = target && target.startsWith("http");

  const results = await Promise.allSettled([
    runAgenticSeo(dir || target),
    isUrl ? runCloudflare(target) : Promise.resolve(null),
    isUrl ? runFern(target) : Promise.resolve(null),
    isUrl ? runVercel(target) : Promise.resolve(null),
    isUrl ? runAgentgrade(target) : Promise.resolve(null),
  ]);

  return {
    agenticSeo: results[0].status === "fulfilled" ? results[0].value : null,
    cloudflare: results[1].status === "fulfilled" ? results[1].value : null,
    fern: results[2].status === "fulfilled" ? results[2].value : null,
    vercel: results[3].status === "fulfilled" ? results[3].value : null,
    agentgrade: results[4].status === "fulfilled" ? results[4].value : null,
  };
}

export function printBenchmarks(benchmarks) {
  const any = Object.values(benchmarks).some((b) => b && b.available);
  if (!any) return;

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

function scoreColor(pct) {
  return pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
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

    for (const check of failed) {
      const msg = check.message
        ? chalk.dim(` ${check.message.slice(0, 50)}`)
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
