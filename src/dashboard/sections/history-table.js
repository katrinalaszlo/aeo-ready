export function renderHistoryTable(history) {
  if (!history.scans || history.scans.length === 0) {
    return `<h2 id="history">Scan History</h2>\n<p style="color:#8b949e;font-size:13px;">No scan history yet.</p>`;
  }

  const scans = [...history.scans].reverse().slice(0, 20);

  let html = `<h2 id="history">Scan History</h2>\n<table>\n<tr><th>Date</th><th>agentic-seo</th><th>Cloudflare</th><th>Fern</th><th>Vercel</th><th>AgentGrade</th><th>Avg</th><th>Delta</th></tr>`;

  for (let i = 0; i < scans.length; i++) {
    const s = scans[i];
    const prev = scans[i + 1];
    const delta = prev ? s.averageScore - prev.averageScore : 0;
    const deltaStr =
      delta > 0
        ? `<span class="trend">+${delta}</span>`
        : delta < 0
          ? `<span class="regression">${delta}</span>`
          : `<span style="color:#8b949e">—</span>`;

    const date = s.timestamp ? s.timestamp.slice(0, 10) : "—";
    const cf =
      s.cloudflare != null && s.cloudflareMax
        ? `${s.cloudflare}/${s.cloudflareMax}`
        : "—";

    html += `\n<tr>
  <td>${date}</td>
  <td>${s.agenticSeo ?? "—"}</td>
  <td>${cf}</td>
  <td>${s.fern ?? "—"}</td>
  <td>${s.vercel ?? "—"}</td>
  <td>${s.agentgrade ?? "—"}</td>
  <td>${s.averageScore ?? "—"}</td>
  <td>${deltaStr}</td>
</tr>`;
  }

  html += `\n</table>`;
  return html;
}
