"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  priceCoverageRatio,
  timeCoverageRatio,
  classifyRetracementActivation,
  classifyCondition,
  classifyRule4Category,
  analyzeRetracementContext
} = require("./neowave_retracement.cjs");

const wave = (start, end) => ({ startPrice: start, endPrice: end });

test("price coverage is measured from termination prices, independent of direction", () => {
  assert.equal(priceCoverageRatio(wave(100, 120), wave(200, 240)).value, 50);
  assert.equal(priceCoverageRatio(wave(120, 100), wave(240, 200)).value, 50);
});

test("time coverage is separate from price coverage and applies only explicit time-unit adjustments", () => {
  const timed = (startIndex, endIndex, availableAt) => ({
    startIndex, endIndex, availableAt
  });
  const numerator = timed(10, 20, 20);
  const denominator = timed(0, 30, 30);
  assert.ok(Math.abs(timeCoverageRatio(numerator, denominator).value - 100 / 3) < 1e-12);
  assert.ok(Math.abs(timeCoverageRatio(numerator, denominator, {
    timeUnit: 1, numeratorAddUnits: 1
  }).value - 110 / 30 * 100) < 1e-12);
  assert.equal(timeCoverageRatio(numerator, denominator, {
    timeUnit: 1, numeratorAddUnits: 1
  }).availableAt, 30);
  assert.equal(timeCoverageRatio({ startIndex: 4, endIndex: 4 }, denominator).status, "indeterminate");
});

test("missing, equal, and zero-denominator waves are indeterminate", () => {
  assert.equal(priceCoverageRatio(null, wave(1, 2)).status, "indeterminate");
  assert.equal(priceCoverageRatio(wave(1, 1), wave(1, 2)).status, "indeterminate");
  assert.equal(priceCoverageRatio(wave(1, 2), wave(4, 4)).status, "indeterminate");
});

test("seven nominal retracement activation bands respect exact boundaries", () => {
  const cases = [
    [38.1999, "NW-RET-01"],
    [38.2, "NW-RET-02"],
    [61.8, "NW-RET-03"],
    [66.0001, "NW-RET-04"],
    [100, "NW-RET-05"],
    [161.8, "NW-RET-06"],
    [261.8, "NW-RET-06"],
    [261.8001, "NW-RET-07"]
  ];
  for (const [value, expected] of cases) {
    assert.ok(classifyRetracementActivation(value).ruleIds.includes(expected), String(value));
  }
});

test("Rule 3 tolerance conflict is surfaced instead of silently resolved", () => {
  for (const value of [58, 60, 62, 66]) {
    const result = classifyRetracementActivation(value);
    assert.equal(result.status, "ambiguous_source_tolerance");
    assert.ok(result.ruleIds.includes("NW-RET-03"));
  }
  assert.equal(classifyRetracementActivation(61.8).status, "classified_activation_only");
});

test("condition maps return one letter at their documented boundaries", () => {
  const cases = [
    [1, 61.8, "b"], [1, 100, "c"], [1, 161.8, "c"], [1, 161.8001, "d"],
    [2, 38.2, "b"], [2, 61.8, "c"], [2, 100, "d"], [2, 161.8, "d"], [2, 161.8001, "e"],
    [3, 161.8, "e"], [3, 216.8, "e"], [3, 261.8001, "f"],
    [4, 100, "c"], [4, 161.8, "d"], [4, 261.8, "d"], [4, 261.8001, "e"],
    [5, 100, "b"], [5, 161.8, "c"], [5, 261.8, "c"], [5, 261.8001, "d"],
    [6, 100, "b"], [7, 261.8, "c"]
  ];
  for (const [rule, value, expected] of cases) {
    const result = classifyCondition(rule, value);
    assert.equal(result.status, "classified_condition_only", `rule ${rule}, value ${value}`);
    assert.equal(result.condition, expected, `rule ${rule}, value ${value}`);
  }
});

test("Rule 3 condition boundary conflict between prose and diagram remains indeterminate", () => {
  assert.equal(classifyCondition(3, 216.8).condition, "e");
  for (const value of [216.8001, 230, 261.8]) {
    const result = classifyCondition(3, value);
    assert.equal(result.status, "indeterminate");
    assert.match(result.reason, /source conflict/);
  }
  assert.equal(classifyCondition(3, 261.8001).condition, "f");
});

test("Rules 5, 6 and 7 share the source diagram's four m0/m1 condition bands", () => {
  for (const rule of [5, 6, 7]) {
    const cases = [
      [99.999, "a"], [100, "b"], [161.7999, "b"],
      [161.8, "c"], [261.8, "c"], [261.8001, "d"]
    ];
    for (const [ratio, expected] of cases) {
      const result = classifyCondition(rule, ratio);
      assert.equal(result.status, "classified_condition_only", `rule ${rule}, ratio ${ratio}`);
      assert.equal(result.condition, expected, `rule ${rule}, ratio ${ratio}`);
    }
  }
});

test("Rule 4 categories enforce the recovered lower bound and inclusive upper band", () => {
  assert.equal(classifyRule4Category(99.99).status, "indeterminate");
  assert.equal(classifyRule4Category(100).category, "i");
  assert.equal(classifyRule4Category(161.8).category, "ii");
  assert.equal(classifyRule4Category(261.8).category, "ii");
  assert.equal(classifyRule4Category(261.8001).category, "iii");
});

test("Rule 4 category requires m3 to reverse the m2 retracement", () => {
  const valid = analyzeRetracementContext({
    m0: wave(50, 100),
    m1: wave(100, 200),
    m2: wave(200, 120),
    m3: wave(120, 240)
  });
  assert.equal(valid.activation.ruleIds[0], "NW-RET-04");
  assert.equal(valid.candidates[0].category.category, "i");

  const invalid = analyzeRetracementContext({
    m0: wave(50, 100),
    m1: wave(100, 200),
    m2: wave(200, 120),
    m3: wave(120, 40)
  });
  assert.equal(invalid.candidates[0].category.status, "indeterminate");
  assert.match(invalid.candidates[0].category.reason, /opposite to the retracement wave/);
});

test("retracement context rejects m2 moving in the same direction as m1", () => {
  const result = analyzeRetracementContext({
    m0: wave(90, 100),
    m1: wave(100, 120),
    m2: wave(120, 132.36)
  });
  assert.equal(result.status, "indeterminate");
  assert.equal(result.tradable, false);
  assert.match(result.reason, /opposite to m1/);
});

test("context analysis reports evidence but never marks a pattern tradable", () => {
  const result = analyzeRetracementContext({
    m0: wave(100, 110),
    m1: wave(110, 130),
    m2: wave(130, 117.64),
    m3: wave(142.36, 167.08)
  });
  assert.equal(result.tradable, false);
  assert.equal(result.activation.ruleIds[0], "NW-RET-03");
  assert.ok(result.candidates[0].condition);
  assert.match(result.disclaimer, /Pre-Constructive/);
});

test("ambiguous rule activation preserves both nominal and Rule 3 hypotheses", () => {
  const result = analyzeRetracementContext({
    m0: wave(1, 2),
    m1: wave(2, 102),
    m2: wave(102, 42)
  });
  assert.equal(result.status, "ambiguous_source_tolerance");
  assert.deepEqual(result.activation.ruleIds.sort(), ["NW-RET-02", "NW-RET-03"]);
  assert.equal(result.tradable, false);
});

test("causal availability is propagated only when every required wave is timestamped", () => {
  const timed = (startPrice, endPrice, availableAt) => ({ startPrice, endPrice, availableAt });
  const result = analyzeRetracementContext({
    m0: timed(100, 110, 12),
    m1: timed(110, 130, 13),
    m2: timed(130, 117.64, 15)
  });
  assert.equal(result.causalAvailabilityVerified, true);
  assert.equal(result.availableAt, 15);

  const incomplete = analyzeRetracementContext({
    m0: timed(100, 110, 12),
    m1: timed(110, 130, 13),
    m2: { startPrice: 130, endPrice: 117.64 }
  });
  assert.equal(incomplete.causalAvailabilityVerified, false);
  assert.equal(incomplete.availableAt, null);
});
