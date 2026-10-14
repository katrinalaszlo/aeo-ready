import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { settleBenchmark } from "./index.js";

describe("settleBenchmark", () => {
  it("adds durationMs to a benchmark that resolves", async () => {
    const progress = [];
    const r = await settleBenchmark(
      "Fern",
      async () => ({ score: 70, maxScore: 100, available: true }),
      (name, ok) => progress.push([name, ok]),
      1000,
    );
    assert.equal(r.available, true);
    assert.equal(r.score, 70);
    assert.equal(typeof r.durationMs, "number");
    assert.deepEqual(progress, [["Fern", true]]);
  });

  it("a benchmark that throws becomes available:false with the error as reason", async () => {
    const r = await settleBenchmark(
      "AgentGrade",
      async () => {
        throw new Error("Command failed: npx agentgrade-cli\nError 503: Service Unavailable");
      },
      undefined,
      1000,
    );
    assert.equal(r.available, false);
    assert.match(r.reason, /Error 503/);
    assert.equal(typeof r.durationMs, "number");
  });

  it("a benchmark that never settles is reported after the deadline, with the others", async () => {
    const progress = [];
    const r = await settleBenchmark(
      "Cloudflare",
      () => new Promise(() => {}),
      (name, ok) => progress.push([name, ok]),
      50,
    );
    assert.deepEqual(progress, [["Cloudflare", false]]);
    assert.equal(r.available, false);
    assert.equal(r.reason, "did not finish within 0s");
    assert.ok(r.durationMs >= 50);
  });
});
