import { execFileSync } from "child_process";

export async function runAgentgrade(url) {
  try {
    const raw = execFileSync("npx", ["agentgrade-cli", url, "--json"], {
      timeout: 60000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) {
      return { available: false, reason: "no JSON in output" };
    }
    const result = JSON.parse(raw.slice(jsonStart));
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
    console.warn(
      `Warning: AgentGrade benchmark failed for ${url}: ${err.message}`,
    );
    return { available: false, reason: err.message?.slice(0, 100) };
  }
}
