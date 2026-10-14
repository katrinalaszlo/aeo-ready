export async function runCloudflare(url) {
  try {
    const res = await fetch("https://isitagentready.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "scan_site",
          arguments: { url },
        },
      }),
    });

    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) return { available: false, reason: "no data in response" };

    const json = JSON.parse(dataLine.slice(5));
    const content = json.result?.content?.[0]?.text || "";
    return { ...parseScan(content), available: true };
  } catch (err) {
    console.warn(
      `Warning: Cloudflare benchmark failed for ${url}: ${err.message}`,
    );
    return { available: false, reason: err.message?.slice(0, 100) };
  }
}

// The scan's markdown report, as isitagentready.com writes it: a "Level N/5" line, one "## Category (n/m passing)"
// heading per category, and one line per check. A passing check reads "- PASS id: message", an informational one
// "- OK id: message", and a failed one "- FAIL id -- message", followed by indented Fix, Skill and Spec lines.
// Before 1.8.1 the check pattern knew only the ": " form, so no FAIL line was ever parsed and every scan read as
// all checks passed next to a low level.
export function parseScan(content) {
  const levelMatch = content.match(/Level (\d)\/5/i);
  const level = levelMatch ? parseInt(levelMatch[1]) : 0;

  const categories = {};
  const catRegex = /## (.+?) \((\d+)\/(\d+) passing\)/g;
  let match;
  while ((match = catRegex.exec(content)) !== null) {
    const name = match[1];
    categories[name.toLowerCase().replace(/[^a-z]+/g, "-")] = {
      name,
      score: parseInt(match[2]),
      maxScore: parseInt(match[3]),
      percentage: Math.round((parseInt(match[2]) / parseInt(match[3])) * 100),
    };
  }

  const checks = [];
  const checkRegex = /^- (PASS|FAIL|OK) (\w+)(?:(?::| --) (.*))?$/gm;
  let cm;
  while ((cm = checkRegex.exec(content)) !== null) {
    checks.push({
      status: cm[1].toLowerCase(),
      id: cm[2],
      message: cm[3] || "",
    });
  }

  return { score: level, maxScore: 5, grade: levelToGrade(level), level, checks, categories };
}

function levelToGrade(level) {
  if (level >= 5) return "A";
  if (level >= 4) return "B";
  if (level >= 3) return "C";
  if (level >= 2) return "D";
  return "F";
}
