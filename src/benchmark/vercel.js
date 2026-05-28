import { execFileSync } from "child_process";

export async function runVercel(url) {
  try {
    const output = execFileSync(
      "npx",
      ["@vercel/agent-readability", "audit", url, "--json"],
      { timeout: 60000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );

    const result = JSON.parse(output);
    const score = result.score ?? 0;
    const maxScore = 100;

    const categories = {};
    for (const [key, cat] of Object.entries(result.categories || {})) {
      categories[key] = {
        name: key.replace(/_/g, " "),
        score: cat.passed,
        maxScore: cat.total,
        percentage:
          cat.total > 0 ? Math.round((cat.passed / cat.total) * 100) : 0,
      };
    }

    const checks = [];
    for (const cat of Object.values(result.categories || {})) {
      for (const check of cat.checks || []) {
        checks.push({
          id: check.name,
          status: check.skipped ? "skip" : check.passed ? "pass" : "fail",
          message: check.detail || check.hint || "",
        });
      }
    }

    return {
      score,
      maxScore,
      grade: ratingToGrade(result.rating),
      categories,
      checks,
      available: true,
    };
  } catch (err) {
    console.warn(`Warning: Vercel benchmark failed for ${url}: ${err.message}`);
    return { available: false, reason: err.message?.slice(0, 100) };
  }
}

function ratingToGrade(rating) {
  if (rating === "Excellent") return "A";
  if (rating === "Good") return "B";
  if (rating === "Fair") return "C";
  if (rating === "Poor") return "D";
  return "F";
}
