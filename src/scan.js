import chalk from "chalk";
import { createInterface } from "readline";
import { execFileSync } from "child_process";
import { runAllBenchmarks, printBenchmarks } from "./benchmark/index.js";
import { saveResult } from "./history/index.js";

export async function scan(opts) {
  const { url, dir, json } = opts;

  if (!json) {
    console.log(chalk.bold("\n  aeo-ready") + chalk.dim(` — ${url}\n`));
    console.log(
      chalk.dim(
        "  Checking agentic-seo · Cloudflare · Fern · Vercel · AgentGrade...\n",
      ),
    );
  }

  const benchmarks = await runAllBenchmarks(url, dir);
  const scores = collectScores(benchmarks);
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;

  const result = {
    url,
    timestamp: new Date().toISOString(),
    averageScore,
    benchmarks,
  };

  if (!json) {
    printReport(result);
  }

  const baseDir = process.cwd();
  await saveResult(result, baseDir);

  if (!json && averageScore < 100 && process.stdin.isTTY) {
    await promptFix(result, dir);
  }

  return result;
}

function collectScores(benchmarks) {
  const scores = [];
  if (benchmarks.agenticSeo?.available) {
    scores.push(benchmarks.agenticSeo.score);
  }
  if (benchmarks.cloudflare?.available) {
    scores.push(
      Math.round(
        (benchmarks.cloudflare.score / benchmarks.cloudflare.maxScore) * 100,
      ),
    );
  }
  if (benchmarks.fern?.available) {
    scores.push(benchmarks.fern.score);
  }
  if (benchmarks.vercel?.available) {
    scores.push(benchmarks.vercel.score);
  }
  if (benchmarks.agentgrade?.available) {
    scores.push(benchmarks.agentgrade.score);
  }
  return scores;
}

function printReport(result) {
  const { benchmarks, averageScore } = result;

  printBenchmarks(benchmarks);

  const gc =
    averageScore >= 80
      ? chalk.green
      : averageScore >= 50
        ? chalk.yellow
        : chalk.red;

  console.log(chalk.dim("  " + "─".repeat(50)));
  console.log(
    `  ${chalk.bold("Overall")}${" ".repeat(37)}${gc.bold(`${averageScore}/100`)}\n`,
  );

  printNextSteps(result);
}

function printNextSteps(result) {
  const { benchmarks, averageScore } = result;
  const steps = [];

  if (averageScore < 80) {
    steps.push(["npx agentic-seo init", "scaffold llms.txt, AGENTS.md"]);
  }

  const cfFails =
    benchmarks.cloudflare?.checks?.filter((c) => c.status === "fail") || [];
  if (cfFails.length > 0) {
    steps.push([
      `Cloudflare: ${cfFails.length} failing`,
      "see isitagentready.com",
    ]);
  }

  const fernFails =
    benchmarks.fern?.checks?.filter(
      (c) => c.status === "fail" || c.status === "warn",
    ) || [];
  if (fernFails.length > 0) {
    steps.push([
      `npx afdocs check ${result.url}`,
      `${fernFails.length} Fern issues`,
    ]);
  }

  steps.push([
    "npx skills add katrinalaszlo/agent-serve",
    "make your product agent-ready",
  ]);

  if (steps.length > 0) {
    console.log(chalk.bold("  Next steps\n"));
    const maxCmd = Math.max(...steps.map(([cmd]) => cmd.length));
    for (const [cmd, desc] of steps) {
      console.log(`    ${cmd.padEnd(maxCmd + 4)}${chalk.dim(desc)}`);
    }
    console.log("");
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

async function promptFix(result, dir) {
  const answer = await ask(chalk.bold("  Fix now? ") + chalk.dim("[y/N] "));
  if (answer !== "y" && answer !== "yes") return;

  console.log("");

  const targetDir = dir || ".";

  console.log(chalk.dim(`  Running: npx agentic-seo init ${targetDir}\n`));
  try {
    execFileSync("npx", ["agentic-seo", "init", targetDir], {
      stdio: "inherit",
    });
  } catch (err) {
    console.log(chalk.red(`\n  agentic-seo init failed: ${err.message}\n`));
  }

  const fernFails =
    result.benchmarks.fern?.checks?.filter(
      (c) => c.status === "fail" || c.status === "warn",
    ) || [];
  if (fernFails.length > 0) {
    console.log(chalk.dim(`\n  Running: npx afdocs check ${result.url}\n`));
    try {
      execFileSync("npx", ["afdocs", "check", result.url], {
        stdio: "inherit",
      });
    } catch (err) {
      console.log(chalk.red(`\n  afdocs failed: ${err.message}\n`));
    }
  }

  console.log(
    chalk.dim("\n  Re-scan to verify: ") +
      `npx aeo-ready scan ${result.url}${dir ? ` --dir ${dir}` : ""}\n`,
  );
}
