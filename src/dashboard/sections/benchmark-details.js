export function renderBenchmarkDetails(result) {
  const { benchmarks } = result;

  let html = `<h2 id="details">Benchmark Details</h2>
<p style="color:#8b949e;font-size:12px;margin-bottom:12px;">Expand each source to see per-check results and how other companies score.</p>`;

  if (benchmarks.agenticSeo?.available) {
    html += renderSource("agentic-seo", "agenticSeo", benchmarks.agenticSeo);
  }
  if (benchmarks.cloudflare?.available) {
    html += renderSource("Cloudflare", "cloudflare", benchmarks.cloudflare);
  }
  if (benchmarks.fern?.available) {
    html += renderSource("Fern", "fern", benchmarks.fern);
  }
  if (benchmarks.vercel?.available) {
    html += renderSource("Vercel", "vercel", benchmarks.vercel);
  }
  if (benchmarks.agentgrade?.available) {
    html += renderSource("AgentGrade", "agentgrade", benchmarks.agentgrade);
  }

  return html;
}

function renderSource(name, key, data) {
  const pct =
    data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;

  let html = `\n<details>
  <summary>
    <span>${esc(name)}</span>
    <span style="color:#8b949e;">${data.score}/${data.maxScore}${data.grade ? ` (${data.grade})` : ""}</span>
  </summary>
  <div style="margin-top:12px;">`;

  if (data.checks && data.checks.length > 0) {
    for (const check of data.checks) {
      if (check.status === "pass") {
        html += `\n    <div class="check pass">+ ${esc(check.id)} ${check.message ? `<span style="color:#8b949e;font-size:11px;">${esc(check.message.slice(0, 80))}</span>` : ""}</div>`;
      } else if (check.status === "fail") {
        html += `\n    <div class="check fail">- ${esc(check.id)} ${check.message ? `<span style="color:#8b949e;font-size:11px;">${esc(check.message.slice(0, 80))}</span>` : ""}</div>`;
      }
    }
  } else if (data.categories) {
    for (const [, cat] of Object.entries(data.categories)) {
      const catPct =
        cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
      const icon = catPct >= 80 ? "+" : catPct >= 40 ? "~" : "-";
      const cls = catPct >= 80 ? "pass" : "fail";
      html += `\n    <div class="check ${cls}">${icon} ${esc(cat.name || "")} ${cat.score}/${cat.maxScore}</div>`;
    }
  }

  html += `\n  </div>\n</details>`;
  return html;
}

function esc(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
