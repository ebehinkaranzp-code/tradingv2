"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RULE_CATALOG,
  ENGINE_CERTIFICATION,
  confirmedPivots,
  monowaves,
  validateNeoWaveCandidate,
  analyze
} = require("./neowave_engine.cjs");

const bars = [
  [10,11,9,10],[10,12,9,11],[11,15,10,14],[14,14,11,12],
  [12,13,8,9],[9,11,8,10],[10,13,9,12],[12,12,10,11],
  [11,12,7,8],[8,10,7,9],[9,11,8,10],[10,12,9,11]
].map((row, i) => ({
  time: i * 60000, open: row[0], high: row[1], low: row[2], close: row[3]
}));

function completeDefinitions({ applies = () => ({ status: "not_applicable", reason: "synthetic fixture: not applicable" }), evaluate = () => ({ status: "pass" }) } = {}) {
  return RULE_CATALOG.map((rule) => ({
    id: rule.id,
    sourceVerified: true,
    source: { document: "synthetic test fixture", locator: "test-only; not an authoritative NeoWave source" },
    applies,
    evaluate
  }));
}

test("confirmed pivots are timestamped only after right-side confirmation", () => {
  const pivots = confirmedPivots(bars, { left: 1, right: 2 });
  assert.ok(pivots.length > 0);
  for (const pivot of pivots) assert.equal(pivot.confirmedAt - pivot.index, 2);
});

test("monowaves connect alternating pivots and retain causal availability", () => {
  const pivots = [
    { index: 1, confirmedAt: 3, price: 10, type: "L" },
    { index: 4, confirmedAt: 6, price: 15, type: "H" },
    { index: 8, confirmedAt: 10, price: 9, type: "L" }
  ];
  const waves = monowaves(pivots);
  assert.equal(waves.length, 2);
  assert.equal(waves[0].direction, "up");
  assert.equal(waves[1].direction, "down");
  for (const wave of waves) {
    assert.ok(wave.duration > 0);
    assert.ok(wave.availableAt >= wave.to.index);
  }
});

test("all seven retracement slots and named research families are catalogued", () => {
  assert.equal(RULE_CATALOG.filter((rule) => rule.family === "retracement").length, 7);
  for (const family of ["impulse", "zigzag", "flat", "triangle", "diametric", "symmetrical", "x_wave"]) {
    assert.ok(RULE_CATALOG.some((rule) => rule.family === family));
  }
});

test("NeoWave gate fails closed when authoritative rule definitions are absent", () => {
  const result = validateNeoWaveCandidate({});
  assert.equal(result.status, "blocked_incomplete_rulebook");
  assert.equal(result.tradable, false);
  assert.ok(result.missingRules.length >= 7);
});

test("a passing evaluator without source provenance cannot certify a rule", () => {
  const definitions = completeDefinitions().map((definition) => ({
    ...definition,
    sourceVerified: false
  }));
  const result = validateNeoWaveCandidate({ pivots: [], waves: [] }, { ruleDefinitions: definitions });
  assert.equal(result.status, "blocked_incomplete_rulebook");
  assert.equal(result.tradable, false);
  assert.equal(result.missingRules.length, RULE_CATALOG.length);
});

test("the production certification barrier cannot be bypassed by caller-supplied fake provenance", () => {
  const definitions = completeDefinitions({
    applies: () => ({ status: "applies" }),
    evaluate: () => ({ status: "pass" })
  });
  const result = validateNeoWaveCandidate({ pivots: [], waves: [] }, { ruleDefinitions: definitions });
  assert.equal(ENGINE_CERTIFICATION.complete, false);
  assert.equal(result.status, "blocked_incomplete_rulebook");
  assert.equal(result.tradable, false);
  assert.equal(result.missingRules.length, RULE_CATALOG.length);
});

test("unknown applicability and failed rules cannot bypass the production block", () => {
  const unknown = completeDefinitions();
  unknown[0].applies = () => ({ status: "unknown" });
  let result = validateNeoWaveCandidate({ pivots: [], waves: [] }, { ruleDefinitions: unknown });
  assert.equal(result.status, "blocked_incomplete_rulebook");
  assert.equal(result.tradable, false);

  const failed = completeDefinitions({
    applies: () => ({ status: "applies" }),
    evaluate: () => ({ status: "fail", reason: "synthetic negative fixture" })
  });
  result = validateNeoWaveCandidate({ pivots: [], waves: [] }, { ruleDefinitions: failed });
  assert.equal(result.status, "blocked_incomplete_rulebook");
  assert.equal(result.tradable, false);
  assert.equal(result.missingRules.length, RULE_CATALOG.length);
});

test("analysis never labels the scaffold as a tradable NeoWave count", () => {
  const result = analyze(bars, { left: 1, right: 2 });
  assert.equal(result.neoWaveGate.tradable, false);
  assert.match(result.disclaimer, /not a complete NeoWave count/);
});

test("malformed and non-monotonic OHLC data are rejected", () => {
  assert.throws(() => confirmedPivots([{ time: 1, open: 2, high: 1, low: 0, close: 1 }]));
  assert.throws(() => confirmedPivots([bars[0], bars[0]]));
});

test("engine exposes source-located retracement diagnostics without certifying a count", () => {
  const { analyzeRetracementContext } = require("./neowave_engine.cjs");
  const result = analyzeRetracementContext({
    m0: { startPrice: 100, endPrice: 110 },
    m1: { startPrice: 110, endPrice: 130 },
    m2: { startPrice: 130, endPrice: 142.36 }
  });
  assert.equal(result.tradable, false);
  assert.equal(result.activation.ruleIds[0], "NW-RET-03");
});
