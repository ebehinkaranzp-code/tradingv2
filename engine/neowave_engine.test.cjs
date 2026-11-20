"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RULE_CATALOG,
  ENGINE_CERTIFICATION,
  confirmedPivots,
  monowaves,
  createHypothesisRevision,
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

test("OHLC bars with both local extremes do not create invented intrabar pivot order", () => {
  const ambiguous = [
    [5, 6, 4, 5], [5, 6, 4, 5], [5, 6, 4, 5],
    [5, 20, 1, 10], [5, 6, 4, 5], [5, 6, 4, 5],
    [5, 6, 4, 5], [5, 6, 4, 5]
  ].map((row, i) => ({
    time: i, open: row[0], high: row[1], low: row[2], close: row[3]
  }));
  const pivots = confirmedPivots(ambiguous, { left: 1, right: 1 });
  assert.equal(pivots.some((pivot) => pivot.index === 3), false);
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

test("monowave construction rejects malformed and non-chronological pivots", () => {
  assert.throws(() => monowaves([
    { index: 2, confirmedAt: 2, price: 10, type: "L" },
    { index: 1, confirmedAt: 2, price: 12, type: "H" }
  ]), /strictly ordered/);
  assert.throws(() => monowaves([
    { index: 1, confirmedAt: 0, price: 10, type: "L" }
  ]), /Invalid pivot/);
  assert.throws(() => monowaves([
    { index: 1, confirmedAt: 2, price: 10, type: "X" }
  ]), /Invalid pivot/);
  const [wave] = monowaves([
    { index: 1, confirmedAt: 3, price: 10, type: "L" },
    { index: 5, confirmedAt: 7, price: 14, type: "H" }
  ]);
  assert.equal(wave.duration, 4);
  assert.equal(wave.durationConvention, "endpoint_index_difference");
});

test("Structure Label hypotheses are retained as causal revisions, not overwritten", () => {
  const first = createHypothesisRevision({
    asOfIndex: 10,
    candidates: [{
      label: "F3",
      rank: "primary",
      source: { document: "Mastering Elliott Wave", locator: "Chapter 3, Rule 1 Condition a" },
      evidence: [{ id: "m1", availableAt: 8 }],
      conditions: [{ id: "five-section-check", status: "indeterminate" }]
    }]
  });
  assert.equal(first.latest.revision, 1);
  assert.equal(first.latest.candidates[0].status, "conditional");
  assert.equal(first.latest.candidates[0].availableAt, 8);

  const second = createHypothesisRevision({
    history: first.history,
    asOfIndex: 14,
    candidates: [{
      label: "F3",
      rank: "primary",
      source: { document: "Mastering Elliott Wave", locator: "Chapter 3, Rule 1 Condition a" },
      evidence: [{ id: "m1", availableAt: 8 }, { id: "m2", availableAt: 14 }],
      conditions: [{ id: "five-section-check", status: "pass" }]
    }]
  });
  assert.equal(second.history.length, 2);
  assert.equal(second.history[0].asOfIndex, 10);
  assert.equal(second.latest.asOfIndex, 14);
  assert.equal(second.latest.candidates[0].status, "supported");
  assert.equal(second.latest.candidates[0].availableAt, 14);
});

test("hypothesis ledger rejects future evidence and non-advancing revisions", () => {
  const candidate = {
    label: "Z",
    rank: "conditional",
    source: { document: "Mastering Elliott Wave", locator: "Chapter 3" },
    evidence: [{ id: "m3", availableAt: 12 }],
    conditions: [{ id: "completion", status: "indeterminate" }]
  };
  assert.throws(() => createHypothesisRevision({ asOfIndex: 11, candidates: [candidate] }), /future evidence/);
  const first = createHypothesisRevision({ asOfIndex: 12, candidates: [candidate] });
  assert.throws(() => createHypothesisRevision({ history: first.history, asOfIndex: 12, candidates: [] }), /advance strictly/);
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
