import chalk from "chalk";
import { runAllBenchmarks, printBenchmarks } from "./benchmark/index.js";
import { saveResult } from "./history/index.js";
import { showRecommendations } from "./recommendations.js";

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

  if (!json && averageScore < 100) {
    await showRecommendations(result);
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
}
