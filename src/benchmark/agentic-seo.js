import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";

const KNOWN_FILES = [
  "robots.txt",
  "llms.txt",
  "llms-full.txt",
  "AGENTS.md",
  "CLAUDE.md",
  "skill.md",
  "agent-permissions.json",
  "agents.json",
  "agents.txt",
  "openapi.json",
  "sitemap.xml",
  ".well-known/ai-plugin.json",
  ".well-known/agent-card.json",
  ".well-known/mcp/server-card.json",
  ".well-known/agent-skills/index.json",
];

async function fetchText(url, headers, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function saveToDisk(tempDir, relativePath, content) {
  const filePath = join(tempDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function parseSitemapUrls(xml, baseUrl) {
  const urls = [];
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  for (const m of matches) {
    const loc = m[1].trim();
    if (loc.startsWith(baseUrl)) urls.push(loc);
  }
  return urls;
}

function urlToFilePath(url) {
  let path = new URL(url).pathname;
  if (path.endsWith("/")) path += "index.html";
  else if (!path.includes(".")) path += ".html";
  return path.replace(/^\//, "");
}

async function discoverSkillFiles(baseUrl, tempDir) {
  const indexContent = await fetchText(
    `${baseUrl}/.well-known/agent-skills/index.json`,
  );
  if (!indexContent) return;

  let index;
  try {
    index = JSON.parse(indexContent);
  } catch {
    return;
  }

  const skills = index.skills || index;
  if (!Array.isArray(skills)) return;

  const fetches = [];
  for (const skill of skills) {
    const dir = skill.path || skill.id;
    if (!dir) continue;

    const base = `.well-known/agent-skills/${dir}`;
    fetches.push(
      fetchText(`${baseUrl}/${base}/SKILL.md`).then((content) => {
        if (content) saveToDisk(tempDir, `${base}/SKILL.md`, content);
      }),
    );

    const refs = skill.references || [];
    for (const ref of refs) {
      const refPath = typeof ref === "string" ? ref : ref.path || ref.file;
      if (!refPath) continue;
      fetches.push(
        fetchText(`${baseUrl}/${base}/references/${refPath}`).then(
          (content) => {
            if (content)
              saveToDisk(tempDir, `${base}/references/${refPath}`, content);
          },
        ),
      );
    }
  }

  await Promise.all(fetches);
}

async function fetchSiteToDir(baseUrl) {
  const tempDir = mkdtempSync(join(tmpdir(), "aeo-"));

  await Promise.all(
    KNOWN_FILES.map(async (file) => {
      const content = await fetchText(`${baseUrl}/${file}`);
      if (content) saveToDisk(tempDir, file, content);
    }),
  );

  await discoverSkillFiles(baseUrl, tempDir);

  const sitemap = await fetchText(`${baseUrl}/sitemap.xml`);
  if (!sitemap) return tempDir;

  const urls = parseSitemapUrls(sitemap, baseUrl);

  await Promise.all(
    urls.map(async (url) => {
      const path = urlToFilePath(url);
      if (KNOWN_FILES.includes(path)) return;

      const [html, md] = await Promise.all([
        fetchText(url),
        fetchText(url, { Accept: "text/markdown" }),
      ]);

      if (html) saveToDisk(tempDir, path, html);

      if (md && md !== html) {
        saveToDisk(tempDir, path.replace(/\.html$/, ".md"), md);
      } else {
        const mdUrl = url
          .replace(/\.html$/, ".md")
          .replace(/\/?$/, (m) => (m === "/" ? "/index.md" : ".md"));
        if (mdUrl !== url) {
          const mdFallback = await fetchText(mdUrl);
          if (mdFallback) {
            saveToDisk(tempDir, path.replace(/\.html$/, ".md"), mdFallback);
          }
        }
      }
    }),
  );

  return tempDir;
}

export async function runBenchmark(target) {
  let tempDir = null;

  try {
    let scanDir;

    if (target && target.startsWith("http")) {
      tempDir = await fetchSiteToDir(target);
      scanDir = tempDir;
    } else {
      scanDir = target || ".";
    }

    const output = execFileSync("npx", ["agentic-seo", scanDir, "--json"], {
      timeout: 60000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const result = JSON.parse(output);
    return {
      score: result.score ?? result.percentage ?? 0,
      maxScore: 100,
      grade: result.grade || null,
      categories: result.categories || null,
      available: true,
    };
  } catch (err) {
    if (err.killed || err.signal) {
      return {
        score: null,
        maxScore: 100,
        available: false,
        reason: "agentic-seo timed out after 60s",
      };
    }
    if (err.message?.includes("not found") || err.message?.includes("ENOENT")) {
      return {
        score: null,
        maxScore: 100,
        available: false,
        reason: "agentic-seo not installed",
      };
    }
    return {
      score: null,
      maxScore: 100,
      available: false,
      reason: err.message?.slice(0, 100),
    };
  } finally {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn(
          `Warning: failed to clean up temp dir ${tempDir}: ${cleanupErr.message}`,
        );
      }
    }
  }
}
