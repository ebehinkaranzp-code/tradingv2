"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RULE_CATALOG,
  DEGREE_HIERARCHY,
  degreeIndex,
  compareDegrees,
  parseStructureLabelList,
  PRECONSTRUCTIVE_SEEDS,
  getPreconstructiveSeed,
  hypothesesFromPreconstructiveSeed,
  analyzeNeoWaveRetracement,
  ENGINE_CERTIFICATION,
  confirmedPivots,
  monowaves,
  aggregateMonowaveGroup,
  createHypothesisRevision,
  evaluateStage1Confirmation,
  evaluateStage2Confirmation,
  evaluateFiveSectionGuidelines,
  timeCoverageRatio: engineTimeCoverageRatio,
  priceCoverageRatio: enginePriceCoverageRatio,
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
  for (const pivot of pivots) {
    assert.equal(pivot.confirmedAt - pivot.index, 2);
    assert.equal(pivot.method, "symmetric_fractal_candidate");
    assert.equal(pivot.sourceVerified, false);
  }
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

test("multi-monowave section uses net endpoint coverage and latest causal availability", () => {
  const pivots = [
    { index: 1, confirmedAt: 2, price: 100, type: "L" },
    { index: 4, confirmedAt: 5, price: 120, type: "H" },
    { index: 8, confirmedAt: 9, price: 110, type: "L" }
  ];
  const waves = monowaves(pivots);
  const group = aggregateMonowaveGroup(waves);
  assert.equal(group.constituentCount, 2);
  assert.equal(group.kind, "candidate_group_not_source_verified_NeoWave_section");
  assert.equal(group.sourceVerified, false);
  assert.equal(group.priceCoverage, 10);
  assert.equal(group.duration, 7);
  assert.equal(group.availableAt, 9);
  assert.equal(group.direction, "up");
});

test("multi-monowave section rejects disconnected constituents", () => {
  const disconnected = [
    {
      from: { index: 1, price: 10 }, to: { index: 3, price: 12 }, availableAt: 4
    },
    {
      from: { index: 4, price: 12 }, to: { index: 6, price: 11 }, availableAt: 7
    }
  ];
  assert.throws(() => aggregateMonowaveGroup(disconnected), /contiguous/);
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

test("Chapter 5 checklist cannot be applied to an unspecified or unrelated structure", () => {
  const sections = Array.from({ length: 5 }, (_, i) => ({
    from: { index: i, price: 10 + i },
    to: { index: i + 1, price: 11 + i }
  }));
  assert.equal(evaluateFiveSectionGuidelines(sections).status, "indeterminate");
  assert.equal(evaluateFiveSectionGuidelines(sections, { structureType: "corrective" }).status, "indeterminate");
});

test("Chapter 5 five-section guidelines pass when all seven necessary checks are supported", () => {
  const points = [
    [0, 100], [5, 150], [7, 130], [13, 190], [15, 170], [22, 240]
  ];
  const sections = points.slice(0, -1).map((point, i) => ({
    from: { index: point[0], price: point[1] },
    to: { index: points[i + 1][0], price: points[i + 1][1] }
  }));
  const result = evaluateFiveSectionGuidelines(sections, { structureType: "trend" });
  assert.equal(result.status, "pass");
  assert.equal(result.tradable, false);
  assert.equal(result.sourceVerified, false);
  assert.equal(result.causalAvailabilityVerified, false);
  assert.equal(result.availableAt, null);
  assert.equal(result.checks.length, 7);
});

test("Chapter 5 checklist availability uses the latest confirmed endpoint", () => {
  const points = [
    [0, 100], [5, 150], [7, 130], [13, 190], [15, 170], [22, 240]
  ];
  const sections = points.slice(0, -1).map((point, i) => ({
    from: { index: point[0], price: point[1], confirmedAt: point[0] + 1 },
    to: { index: points[i + 1][0], price: points[i + 1][1], confirmedAt: points[i + 1][0] + 2 }
  }));
  const result = evaluateFiveSectionGuidelines(sections, { structureType: "trend" });
  assert.equal(result.causalAvailabilityVerified, true);
  assert.equal(result.availableAt, 24);
});

test("Chapter 5 rejects complete retracements and a smallest third section", () => {
  const evaluate = (values) => {
    const points = [[0, 100]];
    let index = 0;
    for (const [duration, change] of values) {
      index += duration;
      points.push([index, points.at(-1)[1] + change]);
    }
    const sections = points.slice(0, -1).map((point, i) => ({
      from: { index: point[0], price: point[1] },
      to: { index: points[i + 1][0], price: points[i + 1][1] }
    }));
    return evaluateFiveSectionGuidelines(sections, { structureType: "trend" });
  };
  const fullRetrace2 = evaluate([[5, 50], [5, -50], [5, 60], [5, -20], [5, 70]]);
  assert.equal(fullRetrace2.checks.find((x) => x.id === "section_2_does_not_retrace_section_1").status, "fail");

  const fullRetrace4 = evaluate([[5, 50], [5, -20], [5, 60], [5, -60], [5, 70]]);
  assert.equal(fullRetrace4.checks.find((x) => x.id === "section_4_does_not_retrace_section_3").status, "fail");

  const thirdSmallest = evaluate([[5, 70], [5, -20], [5, 10], [5, -5], [5, 60]]);
  assert.equal(thirdSmallest.checks.find((x) => x.id === "section_3_not_smallest_of_1_3_5").status, "fail");
});

test("Chapter 5 leaves ambiguous length semantics indeterminate", () => {
  const points = [
    [0, 100], [5, 150], [7, 130], [8, 190], [10, 170], [17, 240]
  ];
  const sections = points.slice(0, -1).map((point, i) => ({
    from: { index: point[0], price: point[1] },
    to: { index: points[i + 1][0], price: points[i + 1][1] }
  }));
  const result = evaluateFiveSectionGuidelines(sections, { structureType: "trend" });
  assert.equal(result.status, "indeterminate");
  assert.equal(result.checks.find((x) => x.id === "section_3_longer_than_section_2").status, "indeterminate");
});

test("Chapter 5 fifth-section fallback requires at least 38.2 percent by price", () => {
  const make = (fifthCoverage) => {
    const points = [
      [0, 100], [5, 150], [7, 130], [13, 190], [19, 150], [22, 150 + fifthCoverage]
    ];
    return points.slice(0, -1).map((point, i) => ({
      from: { index: point[0], price: point[1] },
      to: { index: points[i + 1][0], price: points[i + 1][1] }
    }));
  };
  assert.equal(evaluateFiveSectionGuidelines(make(16), { structureType: "trend" }).checks.find((x) => x.id === "section_5_vs_section_4").status, "pass");
  assert.equal(evaluateFiveSectionGuidelines(make(15), { structureType: "trend" }).checks.find((x) => x.id === "section_5_vs_section_4").status, "fail");
});

test("Chapter 6 stage-one confirmation uses the source timing window and pattern-specific line", () => {
  const standardPending = evaluateStage1Confirmation({
    patternType: "standard", waveStartTime: 10, waveEndTime: 20
  });
  assert.equal(standardPending.status, "pending");
  assert.equal(standardPending.referenceLine, "2-4");
  assert.equal(standardPending.deadline, 30);

  const standardPass = evaluateStage1Confirmation({
    patternType: "standard", waveStartTime: 10, waveEndTime: 20, breakAt: 30
  });
  assert.equal(standardPass.status, "stage1_timing_pass");
  assert.equal(standardPass.overallPatternConfirmed, false);
  assert.equal(standardPass.tradable, false);

  const trianglePass = evaluateStage1Confirmation({
    patternType: "triangle", waveStartTime: 20, waveEndTime: 25, breakAt: 30
  });
  assert.equal(trianglePass.status, "stage1_timing_pass");
  assert.equal(trianglePass.referenceLine, "0-B");
  assert.equal(trianglePass.timingWave, "c");

  const late = evaluateStage1Confirmation({
    patternType: "standard", waveStartTime: 10, waveEndTime: 20, breakAt: 30.001
  });
  assert.equal(late.status, "stage1_timing_fail");
  assert.equal(late.confirmed, false);
});

test("Chapter 6 stage two confirms extended first and third waves at the wave-4 price region", () => {
  const base = {
    stage1Confirmed: true,
    patternType: "impulse",
    pattern: { from: { price: 0 }, to: { price: 200 } },
    wave4: { from: { price: 180 }, to: { price: 150 } },
    wave5: { from: { price: 150 }, to: { price: 200 } }
  };
  const pending = evaluateStage2Confirmation({
    ...base,
    extendedWave: 1,
    correction: { from: { price: 200 }, to: { price: 160 } }
  });
  assert.equal(pending.status, "stage2_pending");

  const pass = evaluateStage2Confirmation({
    ...base,
    extendedWave: 1,
    correction: { from: { price: 200 }, to: { price: 145 } }
  });
  assert.equal(pass.status, "stage2_price_target_pass");
  assert.equal(pass.overallPatternConfirmed, true);

  const blocked = evaluateStage2Confirmation({
    ...base,
    stage1Confirmed: false,
    extendedWave: 1,
    correction: { from: { price: 200 }, to: { price: 145 } }
  });
  assert.equal(blocked.status, "stage2_blocked");
});

test("Chapter 6 extended third wave requires more than 61.8 percent of the whole pattern to retrace", () => {
  const base = {
    stage1Confirmed: true,
    patternType: "impulse",
    extendedWave: 3,
    pattern: { from: { price: 0 }, to: { price: 200 } },
    wave4: { from: { price: 180 }, to: { price: 50 } },
    wave5: { from: { price: 50 }, to: { price: 200 } }
  };
  const pass = evaluateStage2Confirmation({
    ...base,
    correction: { from: { price: 200 }, to: { price: 40 } },
    correctionComplete: true
  });
  assert.equal(pass.status, "stage2_price_target_pass");
  assert.equal(pass.wholePatternRetracementPercent, 80);

  const fail = evaluateStage2Confirmation({
    ...base,
    correction: { from: { price: 200 }, to: { price: 100 } },
    correctionComplete: true
  });
  assert.equal(fail.status, "stage2_price_target_fail");
  assert.equal(fail.extensionEvidence, false);
});

test("Chapter 6 stage two applies the 61.8-to-less-than-100 percent rule to extended wave five", () => {
  const base = {
    stage1Confirmed: true,
    patternType: "impulse",
    extendedWave: 5,
    pattern: { from: { price: 0 }, to: { price: 200 } },
    wave4: { from: { price: 150 }, to: { price: 100 } },
    wave5: { from: { price: 100 }, to: { price: 200 } }
  };
  const pending = evaluateStage2Confirmation({
    ...base,
    correction: { from: { price: 200 }, to: { price: 130 } },
    correctionComplete: false
  });
  assert.equal(pending.status, "stage2_pending");
  assert.equal(pending.retracementOfWave5Percent, 70);

  const pass = evaluateStage2Confirmation({
    ...base,
    correction: { from: { price: 200 }, to: { price: 130 } },
    correctionComplete: true
  });
  assert.equal(pass.status, "stage2_price_retracement_pass");
  assert.equal(pass.overallPatternConfirmed, true);

  const fullRetrace = evaluateStage2Confirmation({
    ...base,
    correction: { from: { price: 200 }, to: { price: 100 } },
    correctionComplete: true
  });
  assert.equal(fullRetrace.status, "stage2_price_retracement_fail");
});

test("Chapter 6 stage two rejects invalid wave directions and non-boolean completion", () => {
  const base = {
    stage1Confirmed: true,
    extendedWave: 5,
    pattern: { from: { price: 0 }, to: { price: 200 } },
    wave4: { from: { price: 150 }, to: { price: 180 } },
    wave5: { from: { price: 180 }, to: { price: 200 } },
    correction: { from: { price: 200 }, to: { price: 130 } },
    correctionComplete: true
  };
  assert.equal(evaluateStage2Confirmation(base).status, "indeterminate");
  assert.equal(evaluateStage2Confirmation({
    ...base,
    wave4: { from: { price: 180 }, to: { price: 150 } },
    wave5: { from: { price: 150 }, to: { price: 200 } },
    correctionComplete: "yes"
  }).status, "indeterminate");
});

test("Chapter 6 stage two requires contiguous impulse endpoints", () => {
  const result = evaluateStage2Confirmation({
    stage1Confirmed: true,
    extendedWave: 5,
    pattern: { from: { price: 0 }, to: { price: 200 } },
    wave4: { from: { price: 150 }, to: { price: 100 } },
    wave5: { from: { price: 99 }, to: { price: 200 } },
    correction: { from: { price: 200 }, to: { price: 130 } },
    correctionComplete: true
  });
  assert.equal(result.status, "indeterminate");
});

test("Chapter 6 stage-one confirmation rejects invalid or premature break times", () => {
  assert.equal(evaluateStage1Confirmation({
    patternType: "standard", waveStartTime: 10, waveEndTime: 20, breakAt: 19
  }).status, "indeterminate");
  assert.equal(evaluateStage1Confirmation({
    patternType: "unknown", waveStartTime: 10, waveEndTime: 20, breakAt: 22
  }).status, "indeterminate");
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

test("Structure Label notation preserves primary and wrapped alternatives", () => {
  const result = parseStructureLabelList("{F3/c3/s5/5/(sL3)/[L5]}");
  assert.equal(result.status, "parsed_source_notation");
  assert.deepEqual(result.candidates.map((candidate) => candidate.label),
    ["F3", "c3", "s5", "5", "sL3", "L5"]);
  assert.equal(result.candidates[0].role, "primary_candidate");
  assert.equal(result.candidates[4].notation, "parenthesized");
  assert.equal(result.candidates[4].primary, false);
  assert.equal(result.candidates[5].notation, "bracketed");
  assert.equal(result.candidates[5].primary, false);
});

test("retracement analysis attaches only available partial Structure Label seeds", () => {
  const result = analyzeNeoWaveRetracement({
    m0: { startPrice: 90, endPrice: 100 },
    m1: { startPrice: 100, endPrice: 200 },
    m2: { startPrice: 200, endPrice: 138.2 }
  });
  assert.equal(result.preconstructiveStatus, "partial_source_seed");
  assert.equal(result.tradable, false);
  assert.equal(result.candidates[0].structureLabelSeed.ruleNumber, 3);
  assert.deepEqual(result.candidates[0].structureLabelSeed.labels.map((x) => x.label),
    ["F3", "c3", "s5", "5", "sL3", "L5"]);
  assert.equal(result.candidates[0].structureLabelHypotheses.status, "candidate_hypotheses");
  assert.equal(result.candidates[0].structureLabelHypotheses.candidates[0].rank, "primary");
  assert.ok(result.candidates[0].structureLabelHypotheses.candidates.every((x) => x.conditions[0].status === "indeterminate"));
});

test("Rule 1:a and Rule 2:a source seeds attach to matching measured contexts", () => {
  const rule1 = analyzeNeoWaveRetracement({
    m0: { startPrice: 90, endPrice: 100 },
    m1: { startPrice: 100, endPrice: 200 },
    m2: { startPrice: 200, endPrice: 170 }
  });
  assert.equal(rule1.activation.ruleIds[0], "NW-RET-01");
  assert.equal(rule1.candidates[0].condition.condition, "a");
  assert.equal(rule1.candidates[0].structureLabelSeed.status, "partial_source_seed");

  const rule2 = analyzeNeoWaveRetracement({
    m0: { startPrice: 90, endPrice: 100 },
    m1: { startPrice: 100, endPrice: 200 },
    m2: { startPrice: 200, endPrice: 160 }
  });
  assert.equal(rule2.activation.ruleIds[0], "NW-RET-02");
  assert.equal(rule2.candidates[0].condition.condition, "a");
  assert.equal(rule2.candidates[0].structureLabelSeed.status, "partial_source_seed");
});

test("untranscribed Rule/Condition combinations stay indeterminate", () => {
  const result = analyzeNeoWaveRetracement({
    m0: { startPrice: 90, endPrice: 140 },
    m1: { startPrice: 100, endPrice: 200 },
    m2: { startPrice: 200, endPrice: 150 }
  });
  assert.equal(result.preconstructiveStatus, "incomplete_source_mapping");
  assert.equal(result.candidates[0].structureLabelSeed.status, "indeterminate");
  assert.equal(result.tradable, false);
});

test("Pre-Constructive seed table exposes only transcribed labels and remains non-executable", () => {
  assert.deepEqual(Object.keys(PRECONSTRUCTIVE_SEEDS).sort(), ["1:a", "2:a", "3:a"]);
  const rule3a = getPreconstructiveSeed(3, "a");
  assert.equal(rule3a.status, "partial_source_seed");
  assert.equal(rule3a.tradable, false);
  assert.equal(rule3a.conditionsEvaluated, false);
  assert.deepEqual(rule3a.labels.map((label) => label.label),
    ["F3", "c3", "s5", "5", "sL3", "L5"]);
  assert.equal(getPreconstructiveSeed(7, "d").status, "indeterminate");
});

test("partial Pre-Constructive labels become ranked competing hypotheses", () => {
  const seed = getPreconstructiveSeed(3, "a");
  const generated = hypothesesFromPreconstructiveSeed(seed, {
    evidence: [{ id: "m0-m1-m2", availableAt: 12 }],
    conditions: [{ id: "preconstructive-context", status: "indeterminate" }]
  });
  assert.equal(generated.status, "candidate_hypotheses");
  assert.equal(generated.complete, false);
  assert.equal(generated.tradable, false);
  assert.equal(generated.candidates.length, 6);
  assert.equal(generated.candidates[0].rank, "primary");
  assert.equal(generated.candidates[4].rank, "conditional");
  const revision = createHypothesisRevision({
    asOfIndex: 12,
    candidates: generated.candidates
  });
  assert.ok(revision.latest.candidates.every((candidate) => candidate.status === "conditional"));
});

test("hypothesis with no evaluated conditions remains conditional", () => {
  const result = createHypothesisRevision({
    asOfIndex: 3,
    candidates: [{
      label: "F3",
      rank: "primary",
      source: { document: "Mastering Elliott Wave", locator: "Chapter 3" },
      evidence: [{ id: "m1", availableAt: 3 }],
      conditions: []
    }]
  });
  assert.equal(result.latest.candidates[0].status, "conditional");
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

test("engine public API exposes separate price and time coverage helpers", () => {
  assert.equal(enginePriceCoverageRatio(
    { startPrice: 1, endPrice: 3 },
    { startPrice: 1, endPrice: 5 }
  ).value, 50);
  assert.equal(engineTimeCoverageRatio(
    { startIndex: 0, endIndex: 2 },
    { startIndex: 0, endIndex: 4 }
  ).value, 50);
});

test("degree hierarchy follows the source order and refuses unknown degree labels", () => {
  assert.equal(DEGREE_HIERARCHY[0], "Grand Supercycle");
  assert.equal(DEGREE_HIERARCHY.at(-1), "Sub-Micro");
  assert.equal(degreeIndex("Cycle"), 2);
  assert.equal(compareDegrees("Primary", "Minor").relation, "higher");
  assert.equal(compareDegrees("Minute", "Minute").relation, "same");
  assert.equal(compareDegrees("unknown", "Micro").status, "indeterminate");
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
  assert.equal(result.sourceObservationRulesApplied, false);
  assert.equal(result.patternStatus, "not_evaluated");
  assert.equal(result.structure.priceTimeMetricStatus, "heuristic_not_Neely_Rule_of_Proportion");
  assert.match(result.pivotMethod, /not_Neely_Rules_of_Observation/);
  assert.match(result.disclaimer, /heuristic candidates/);
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
    m2: { startPrice: 130, endPrice: 117.64 }
  });
  assert.equal(result.tradable, false);
  assert.equal(result.activation.ruleIds[0], "NW-RET-03");
});
