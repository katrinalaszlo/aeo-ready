#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { scan } from "../src/scan.js";
import { getHistory } from "../src/history/index.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
);

const program = new Command();

program
  .name("aeo-ready")
  .description("AEO benchmark aggregator. One scan, every score.")
  .version(pkg.version);

program
  .command("scan [url]")
  .description(
    "Run all AEO benchmarks against a URL (add --dir for local scanning)",
  )
  .option(
    "-d, --dir <path>",
    "Local directory to scan (gives agentic-seo full access)",
  )
  .option("--json", "Output results as JSON")
  .option(
    "--threshold <number>",
    "Minimum average score to pass (exit 1 if below)",
    parseInt,
  )
  .action(async (url, opts) => {
    try {
      if (url && !url.startsWith("http")) url = `https://${url}`;
      if (!url) {
        console.error("  Usage: npx aeo-ready scan <url>");
        console.error("         npx aeo-ready scan <url> --dir ./public");
        process.exit(1);
      }

      const result = await scan({
        url,
        dir: opts.dir || null,
        json: opts.json || false,
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }

      if (opts.threshold && result.averageScore < opts.threshold) {
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("history")
  .description("Show past scan scores")
  .action(() => {
    const history = getHistory(process.cwd());
    if (history.scans.length === 0) {
      console.log("  No scans yet. Run: npx aeo-ready scan <url>");
      return;
    }
    console.log("");
    const rows = history.scans.slice(-10).map((s) => {
      const date = new Date(s.timestamp).toLocaleDateString();
      const parts = [];
      if (s.agenticSeo != null) parts.push(`seo:${s.agenticSeo}`);
      if (s.cloudflare != null)
        parts.push(`cf:${s.cloudflare}/${s.cloudflareMax || "?"}`);
      if (s.fern != null) parts.push(`fern:${s.fern}`);
      const gc =
        s.averageScore >= 80
          ? chalk.green
          : s.averageScore >= 50
            ? chalk.yellow
            : chalk.red;
      const scoreStr = gc(String(s.averageScore).padEnd(6));
      return `  ${date.padEnd(12)} ${scoreStr} ${parts.join("  ")}  ${s.url}`;
    });
    console.log(`  ${"Date".padEnd(12)} ${"Avg".padEnd(6)} Scores`);
    console.log(`  ${"─".repeat(60)}`);
    for (const row of rows) console.log(row);
    console.log("");
  });

program.parse();
