import { execFileSync } from "child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export async function runAgentgrade(url) {
  // agentgrade-cli exits before flushing large output to a pipe, truncating
  // the JSON mid-document. A real file gets synchronous writes, so capture
  // stdout there instead of piping it.
  const dir = mkdtempSync(join(tmpdir(), "agentgrade-"));
  const outFile = join(dir, "out.json");
  try {
    const fd = openSync(outFile, "w");
    try {
      execFileSync("npx", ["agentgrade-cli", url, "--json"], {
        timeout: 120000,
        stdio: ["ignore", fd, "pipe"],
      });
    } finally {
      closeSync(fd);
    }
    const raw = readFileSync(outFile, "utf8");

    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) {
      return { available: false, reason: "no JSON in output" };
    }
    let result;
    try {
      result = JSON.parse(raw.slice(jsonStart));
    } catch {
      return { available: false, reason: "agentgrade-cli returned malformed JSON" };
    }
    const scoreObj = result.score || {};

    const categories = {};
    for (const group of scoreObj.groups || []) {
      if (!group.applicable) continue;
      categories[group.key] = {
        name: group.label,
        score: group.passed,
        maxScore: group.total,
        percentage: group.pct ?? 0,
      };
    }

    const checks = [];
    for (const group of scoreObj.groups || []) {
      if (!group.applicable) continue;
      for (const check of group.checks || []) {
        checks.push({
          id: check.label,
          status: check.passed ? "pass" : "fail",
          message: check.hint || "",
        });
      }
    }

    return {
      score: scoreObj.pct ?? 0,
      maxScore: 100,
      grade: scoreObj.grade || null,
      categories,
      checks,
      available: true,
    };
  } catch (err) {
    if (err.killed || err.signal) {
      console.warn(`Warning: AgentGrade benchmark timed out for ${url}`);
      return { available: false, reason: "agentgrade-cli timed out after 120s" };
    }
    console.warn(
      `Warning: AgentGrade benchmark failed for ${url}: ${err.message}`,
    );
    return { available: false, reason: err.message?.slice(0, 100) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
