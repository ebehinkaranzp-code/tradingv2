"use strict";

const { analyzeRetracementContext, timeCoverageRatio, priceCoverageRatio } = require("./neowave_retracement.cjs");

const RETRACEMENT_RULES = Array.from({ length: 7 }, (_, i) => ({
  id: "NW-RET-" + String(i + 1).padStart(2, "0"),
  family: "retracement",
  status: "activation_and_condition_diagnostics_only"
}));

const ENGINE_CERTIFICATION = Object.freeze({
  complete: false,
  sourceReviewed: false,
  independentRuleTests: false,
  reason: "The source-backed NeoWave rulebook and independent pattern tests are incomplete."
});

// Chapter 7 degree names in source order, from largest to smallest.
const DEGREE_HIERARCHY = Object.freeze([
  "Grand Supercycle",
  "Supercycle",
  "Cycle",
  "Primary",
  "Intermediate",
  "Minor",
  "Minute",
  "Minuette",
  "Sub-Minuette",
  "Micro",
  "Sub-Micro"
]);

function assessXWaveDegreeRelation({
  leftPatternDegree,
  rightPatternDegree,
  xWaveDegree,
  documentedException = false
} = {}) {
  const left = degreeIndex(leftPatternDegree);
  const right = degreeIndex(rightPatternDegree);
  const x = degreeIndex(xWaveDegree);
  if (left < 0 || right < 0 || x < 0 || typeof documentedException !== "boolean") {
    return { status: "indeterminate", relation: null, reason: "known degree names and an explicit exception flag are required" };
  }
  if (left !== right) {
    return { status: "indeterminate", relation: null, reason: "source expectation compares the X-wave with two adjacent patterns of the same degree" };
  }
  if (x === left + 1) {
    return { status: "consistent", relation: "one_degree_below_adjacent_patterns" };
  }
  if (documentedException) {
    return { status: "documented_exception", relation: "atypical_degree_relation" };
  }
  return {
    status: "atypical_needs_review",
    relation: "not_one_degree_below",
    reason: "source says this is normally one degree below; rare exceptions are possible and need independent evidence"
  };
}

function degreeIndex(degree) {
  return DEGREE_HIERARCHY.indexOf(degree);
}

function compareDegrees(first, second) {
  const a = degreeIndex(first);
  const b = degreeIndex(second);
  if (a < 0 || b < 0) {
    return { status: "indeterminate", relation: null, reason: "unknown degree name" };
  }
  return {
    status: "measured",
    relation: a === b ? "same" : a < b ? "higher" : "lower",
    firstIndex: a,
    secondIndex: b
  };
}

const OTHER_RULE_FAMILIES = [
  "monowave", "polywave", "degree_consistency", "price_time_proportionality",
  "impulse", "zigzag", "flat", "triangle", "combination", "diametric",
  "symmetrical", "x_wave", "overlap", "alternation", "pattern_completion",
  "post_pattern_confirmation", "invalidation_and_recount"
];

const RULE_CATALOG = Object.freeze([
  ...RETRACEMENT_RULES,
  ...OTHER_RULE_FAMILIES.map((family) => ({
    id: "NW-" + family.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    family,
    status: "research_scaffold_only"
  }))
].map((rule) => Object.freeze({
  ...rule,
  requiredForEngineCertification: true,
  applicability: "not_yet_defined",
  mandatoryForEveryCandidate: false
})));

function validateBars(bars) {
  if (!Array.isArray(bars) || bars.length < 8) {
    throw Error("At least 8 OHLC bars are required");
  }
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (
      !b ||
      ![b.time, b.open, b.high, b.low, b.close].every(Number.isFinite) ||
      b.low > Math.min(b.open, b.close) ||
      b.high < Math.max(b.open, b.close) ||
      (i && b.time <= bars[i - 1].time)
    ) {
      throw Error("Invalid OHLC bar at index " + i);
    }
  }
}

function confirmedPivots(bars, { left = 3, right = 3 } = {}) {
  validateBars(bars);
  if (!Number.isInteger(left) || !Number.isInteger(right) || left < 1 || right < 1) {
    throw Error("left/right must be positive integers");
  }

  const events = [];
  for (let p = left; p < bars.length - right; p++) {
    let isHigh = true;
    let isLow = true;
    for (let j = p - left; j <= p + right; j++) {
      if (j === p) continue;
      if (bars[j].high >= bars[p].high) isHigh = false;
      if (bars[j].low <= bars[p].low) isLow = false;
    }
    // If one OHLC bar is simultaneously the local high and local low,
    // OHLC data does not reveal which extreme occurred first. Do not invent
    // an intrabar ordering or emit two pivots at the same source index.
    if (isHigh && isLow) continue;
    if (isHigh) {
      events.push({
        index: p, confirmedAt: p + right, time: bars[p].time,
        price: bars[p].high, type: "H", method: "symmetric_fractal_candidate", sourceVerified: false
      });
    } else if (isLow) {
      events.push({
        index: p, confirmedAt: p + right, time: bars[p].time,
        price: bars[p].low, type: "L", method: "symmetric_fractal_candidate", sourceVerified: false
      });
    }
  }

  events.sort((a, b) => a.confirmedAt - b.confirmedAt || a.index - b.index);
  const pivots = [];
  for (const pivot of events) {
    const previous = pivots.at(-1);
    if (!previous) {
      pivots.push(pivot);
    } else if (previous.type === pivot.type) {
      const moreExtreme = pivot.type === "H"
        ? pivot.price > previous.price
        : pivot.price < previous.price;
      if (moreExtreme) pivots[pivots.length - 1] = pivot;
    } else {
      pivots.push(pivot);
    }
  }
  return pivots;
}

function monowaves(pivots) {
  if (!Array.isArray(pivots)) throw Error("pivots must be an array");
  for (let i = 0; i < pivots.length; i++) {
    const pivot = pivots[i];
    if (!pivot || !Number.isInteger(pivot.index) || pivot.index < 0 ||
        !Number.isInteger(pivot.confirmedAt) || pivot.confirmedAt < pivot.index ||
        !Number.isFinite(pivot.price) || !["H", "L"].includes(pivot.type)) {
      throw Error("Invalid pivot at index " + i);
    }
    if (i && pivot.index <= pivots[i - 1].index) {
      throw Error("Pivots must be strictly ordered by source-bar index");
    }
  }

  const waves = [];
  for (let i = 1; i < pivots.length; i++) {
    const from = pivots[i - 1];
    const to = pivots[i];
    if (from.type === to.type) continue;
    const duration = to.index - from.index;
    const priceChange = to.price - from.price;
    if (duration <= 0 || !Number.isFinite(priceChange) || priceChange === 0) continue;
    waves.push({
      from,
      to,
      kind: "candidate_segment_not_source_verified_monowave",
      sourceVerified: false,
      direction: priceChange > 0 ? "up" : "down",
      priceChange,
      absoluteChange: Math.abs(priceChange),
      duration,
      durationConvention: "endpoint_index_difference",
      barsPerPriceUnit: duration / Math.abs(priceChange),
      availableAt: Math.max(from.confirmedAt, to.confirmedAt)
    });
  }
  return waves;
}

/**
 * Aggregate one or more consecutive monowaves into a labeled NeoWave section
 * (for example m0 or m2). Price coverage is measured endpoint-to-endpoint,
 * not by summing the internal zigzag path.
 */
function aggregateMonowaveGroup(waves) {
  if (!Array.isArray(waves) || waves.length === 0) {
    throw Error("a monowave group must contain at least one wave");
  }
  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i];
    if (!wave?.from || !wave?.to ||
        !Number.isInteger(wave.from.index) || !Number.isInteger(wave.to.index) ||
        wave.to.index <= wave.from.index ||
        !Number.isFinite(wave.from.price) || !Number.isFinite(wave.to.price)) {
      throw Error("invalid monowave at group index " + i);
    }
    if (i) {
      const previous = waves[i - 1];
      if (previous.to.index !== wave.from.index ||
          previous.to.price !== wave.from.price) {
        throw Error("monowaves in a group must be contiguous at shared endpoints");
      }
    }
  }
  const first = waves[0];
  const last = waves.at(-1);
  const priceChange = last.to.price - first.from.price;
  const duration = last.to.index - first.from.index;
  const availableTimes = waves.map((wave) => wave.availableAt)
    .filter(Number.isFinite);
  return {
    from: first.from,
    to: last.to,
    kind: "candidate_group_not_source_verified_NeoWave_section",
    sourceVerified: false,
    direction: priceChange > 0 ? "up" : priceChange < 0 ? "down" : "flat",
    priceChange,
    absoluteChange: Math.abs(priceChange),
    priceCoverage: Math.abs(priceChange),
    duration,
    constituentCount: waves.length,
    constituentWaveIndices: waves.map((wave) => ({
      from: wave.from.index,
      to: wave.to.index
    })),
    availableAt: availableTimes.length === waves.length ? Math.max(...availableTimes) : null
  };
}

function summarizeStructure(waves) {
  const ratios = waves.map((wave) => wave.barsPerPriceUnit).filter(Number.isFinite);
  const sorted = ratios.slice().sort((a, b) => a - b);
  return {
    waveCount: waves.length,
    classification: waves.length ? "unclassified_candidate_wave_sequence" : "insufficient_data",
    priceTimeMetricStatus: "heuristic_not_Neely_Rule_of_Proportion",
    alternating: waves.every((wave, i) => i === 0 || wave.direction !== waves[i - 1].direction),
    priceTimeRatios: ratios,
    medianBarsPerPriceUnit: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  };
}

/**
 * Evaluate the Chapter 5 seven-point checklist for a candidate five-section
 * trend/terminal structure. Ambiguous uses of "longer" remain indeterminate
 * unless price and time comparisons agree.
 */
function evaluateFiveSectionGuidelines(sections, { structureType } = {}) {
  if (!["trend", "terminal"].includes(structureType)) {
    return { status: "indeterminate", checks: [], reason: "the Chapter 5 checklist applies only to trend or terminal candidates" };
  }
  if (!Array.isArray(sections) || sections.length !== 5) {
    return { status: "indeterminate", checks: [], reason: "exactly five adjacent sections are required" };
  }
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section?.from || !section?.to ||
        !Number.isInteger(section.from.index) || !Number.isInteger(section.to.index) ||
        section.to.index <= section.from.index ||
        !Number.isFinite(section.from.price) || !Number.isFinite(section.to.price) ||
        section.from.price === section.to.price) {
      return { status: "indeterminate", checks: [], reason: "each section needs ordered endpoints with distinct finite prices" };
    }
    if (i && (sections[i - 1].to.index !== section.from.index ||
        sections[i - 1].to.price !== section.from.price)) {
      return { status: "indeterminate", checks: [], reason: "the five sections must be contiguous at shared endpoints" };
    }
  }

  const metrics = sections.map((section) => ({
    price: Math.abs(section.to.price - section.from.price),
    time: section.to.index - section.from.index,
    direction: section.to.price > section.from.price ? "up" : "down"
  }));
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  add("five_adjacent_sections", "pass", "five ordered, contiguous sections with shared endpoints are present");

  const expectedDirections = [
    metrics[0].direction,
    metrics[0].direction === "up" ? "down" : "up",
    metrics[0].direction,
    metrics[0].direction === "up" ? "down" : "up",
    metrics[0].direction
  ];
  add("five_section_direction_sequence",
    metrics.every((metric, i) => metric.direction === expectedDirections[i]) ? "pass" : "fail",
    "sections 1, 3 and 5 must progress in one direction; sections 2 and 4 must oppose them");

  add("section_2_does_not_retrace_section_1",
    metrics[1].price < metrics[0].price ? "pass" : "fail",
    "section 2 must not completely retrace section 1 by price");
  add("section_4_does_not_retrace_section_3",
    metrics[3].price < metrics[2].price ? "pass" : "fail",
    "section 4 must not completely retrace section 3 by price");

  const primaryPrice = metrics[0].price;
  const thirdPrice = metrics[2].price;
  const fifthPrice = metrics[4].price;
  add("section_3_not_smallest_of_1_3_5",
    thirdPrice > Math.min(primaryPrice, fifthPrice) ? "pass" : "fail",
    "by vertical price coverage, section 3 must not be the smallest of sections 1, 3 and 5");

  const compareLonger = (first, second) => {
    const priceGreater = first.price > second.price;
    const timeGreater = first.time > second.time;
    const priceNotGreater = first.price <= second.price;
    const timeNotGreater = first.time <= second.time;
    if (priceGreater && timeGreater) return "pass";
    if (priceNotGreater && timeNotGreater) return "fail";
    return "indeterminate";
  };
  add("section_3_longer_than_section_2",
    compareLonger(metrics[2], metrics[1]),
    "source says 'longer' without specifying a single metric here; price and time must agree to resolve it");

  const fifthVsFourth = compareLonger(metrics[4], metrics[3]);
  let fifthStatus = fifthVsFourth;
  let fifthDetail = "source says section 5 is almost always longer than section 4; price and time comparisons must agree";
  if (fifthVsFourth === "fail") {
    const ratio = metrics[4].price / metrics[3].price * 100;
    fifthStatus = ratio >= 38.2 ? "pass" : "fail";
    fifthDetail = "section 4 is longer by both price and time; source fallback requires section 5 to cover at least 38.2% of section 4 by price";
  }
  add("section_5_vs_section_4", fifthStatus, fifthDetail);

  const statuses = checks.map((check) => check.status);
  const status = statuses.includes("fail") ? "fail"
    : statuses.includes("indeterminate") ? "indeterminate" : "pass";
  const availability = sections.map((section) => {
    if (Number.isFinite(section.availableAt)) return section.availableAt;
    const fromAt = section.from.confirmedAt;
    const toAt = section.to.confirmedAt;
    return Number.isFinite(fromAt) && Number.isFinite(toAt) ? Math.max(fromAt, toAt) : null;
  });
  const causalAvailabilityVerified = availability.every(Number.isFinite);
  return {
    status,
    tradable: false,
    sourceVerified: false,
    structureType,
    source: { document: "Mastering Elliott Wave", locator: "Chapter 5, printed p. 5-3, Necessary Structural Rules" },
    checks,
    measurements: metrics,
    availableAt: causalAvailabilityVerified ? Math.max(...availability) : null,
    causalAvailabilityVerified,
    disclaimer: "This checklist is necessary-conditions diagnostics only; it does not identify a pattern family or establish completion/confirmation."
  };
}

/**
 * Chapter 6 first-stage confirmation timing diagnostic.
 * A trendline break is supplied by the caller's independently checked
 * price/bar analysis; this function only evaluates the source's time window.
 */
/**
 * Chapter 6 second-stage price-retracement confirmation for standard impulses.
 * This checks the source's minimum/target retracement after stage one. It does
 * not infer the extended wave or determine when a correction is complete.
 */
/**
 * Chapter 6 truncated-fifth follow-through check.
 * The source describes a fifth wave shorter than wave 4, followed by a strong
 * countertrend move and no new trend extreme before the whole impulse retraces.
 * "Strong" is qualitative in the source, so the caller must explicitly attest it.
 */
/**
 * Chapter 6 triangle case where wave b is longer than wave a.
 * Stage 1: wave c must be completely retraced within one c-wave duration.
 */
function evaluateTriangleLongBStage1({
  waveCStartTime,
  waveCEndTime,
  cRetracedAt
} = {}) {
  const base = {
    stage: 1,
    confirmed: false,
    overallPatternConfirmed: false,
    tradable: false,
    sourceVerified: false,
    referenceLine: null,
    trigger: "full_retracement_of_wave_c"
  };
  if (!Number.isFinite(waveCStartTime) || !Number.isFinite(waveCEndTime) ||
      waveCStartTime < 0 || waveCEndTime <= waveCStartTime) {
    return { ...base, status: "indeterminate", reason: "a positive, ordered wave-c time interval is required" };
  }
  const duration = waveCEndTime - waveCStartTime;
  const deadline = waveCEndTime + duration;
  if (cRetracedAt == null) {
    return { ...base, status: "pending", duration, deadline, reason: "awaiting complete retracement of wave c" };
  }
  if (!Number.isFinite(cRetracedAt) || cRetracedAt < waveCEndTime) {
    return { ...base, status: "indeterminate", reason: "cRetracedAt must be a finite time at or after wave c ends" };
  }
  const confirmed = cRetracedAt <= deadline;
  return {
    ...base,
    status: confirmed ? "stage1_timing_pass" : "stage1_timing_fail",
    confirmed,
    duration,
    retracedAt: cRetracedAt,
    availableAt: cRetracedAt,
    deadline,
    reason: confirmed
      ? "wave c was completely retraced within one c-wave duration"
      : "wave c was not completely retraced within one c-wave duration"
  };
}

/**
 * Chapter 6 triangle case where wave b is longer than wave a.
 * Stage 2: break of the 0-B line within one c-wave duration.
 */
function evaluateTriangleLongBStage2({
  stage1Confirmed,
  waveCStartTime,
  waveCEndTime,
  breakAt
} = {}) {
  const base = {
    stage: 2,
    confirmed: false,
    overallPatternConfirmed: false,
    tradable: false,
    sourceVerified: false,
    referenceLine: "0-B",
    trigger: "trendline_break"
  };
  if (stage1Confirmed !== true) {
    return { ...base, status: "stage2_blocked", reason: "triangle stage one must pass before stage two" };
  }
  if (!Number.isFinite(waveCStartTime) || !Number.isFinite(waveCEndTime) ||
      waveCStartTime < 0 || waveCEndTime <= waveCStartTime) {
    return { ...base, status: "indeterminate", reason: "a positive, ordered wave-c time interval is required" };
  }
  const duration = waveCEndTime - waveCStartTime;
  const deadline = waveCEndTime + duration;
  if (breakAt == null) {
    return { ...base, status: "pending", duration, deadline, reason: "awaiting a break of the 0-B trendline" };
  }
  if (!Number.isFinite(breakAt) || breakAt < waveCEndTime) {
    return { ...base, status: "indeterminate", reason: "breakAt must be a finite time at or after wave c ends" };
  }
  const confirmed = breakAt <= deadline;
  return {
    ...base,
    status: confirmed ? "stage2_timing_pass" : "stage2_timing_fail",
    confirmed,
    duration,
    breakAt,
    availableAt: breakAt,
    deadline,
    reason: confirmed
      ? "0-B trendline broke within one c-wave duration"
      : "0-B trendline break exceeded one c-wave duration"
  };
}

/**
 * Chapter 6 triangle-type confirmation uses the 1-3 trendline in place of 0-B.
 */
function evaluateTrianglePatternTypeStage1({
  triangleType,
  waveCStartTime,
  waveCEndTime,
  breakAt
} = {}) {
  const base = {
    stage: 1,
    confirmed: false,
    overallPatternConfirmed: false,
    tradable: false,
    sourceVerified: false,
    referenceLine: "1-3",
    trigger: "trendline_break"
  };
  if (!["contracting", "expanding"].includes(triangleType)) {
    return { ...base, status: "indeterminate", reason: "triangleType must be contracting or expanding" };
  }
  if (!Number.isFinite(waveCStartTime) || !Number.isFinite(waveCEndTime) ||
      waveCStartTime < 0 || waveCEndTime <= waveCStartTime) {
    return { ...base, status: "indeterminate", reason: "a positive, ordered wave-c time interval is required" };
  }
  const duration = waveCEndTime - waveCStartTime;
  const deadline = waveCEndTime + duration;
  if (breakAt == null) {
    return { ...base, status: "pending", duration, deadline, reason: "awaiting a break of the 1-3 trendline" };
  }
  if (!Number.isFinite(breakAt) || breakAt < waveCEndTime) {
    return { ...base, status: "indeterminate", reason: "breakAt must be a finite time at or after wave c ends" };
  }
  const confirmed = breakAt <= deadline;
  return {
    ...base,
    status: confirmed ? "stage1_timing_pass" : "stage1_timing_fail",
    confirmed,
    duration,
    breakAt,
    availableAt: breakAt,
    deadline,
    reason: confirmed
      ? "1-3 trendline broke within one c-wave duration"
      : "1-3 trendline break exceeded one c-wave duration"
  };
}

/**
 * Expanding triangles gain validity through non-confirmation: wave c is not
 * fully retraced, or its full retracement takes longer than c itself took.
 */
function evaluateExpandingTriangleNonConfirmation({
  waveCStartTime,
  waveCEndTime,
  fullyRetracedC,
  fullRetracementAt
} = {}) {
  const base = { status: "indeterminate", tradable: false, sourceVerified: false, valid: false };
  if (!Number.isFinite(waveCStartTime) || !Number.isFinite(waveCEndTime) ||
      waveCStartTime < 0 || waveCEndTime <= waveCStartTime ||
      typeof fullyRetracedC !== "boolean") {
    return { ...base, reason: "ordered wave-c times and an explicit fullyRetracedC flag are required" };
  }
  const duration = waveCEndTime - waveCStartTime;
  const deadline = waveCEndTime + duration;
  if (!fullyRetracedC) {
    return {
      ...base,
      status: "non_confirmation_condition_pass",
      valid: true,
      duration,
      deadline,
      reason: "wave c has not been fully retraced, satisfying the expanding-triangle non-confirmation condition"
    };
  }
  if (!Number.isFinite(fullRetracementAt) || fullRetracementAt < waveCEndTime) {
    return { ...base, reason: "fullRetracementAt is required when wave c has been fully retraced" };
  }
  const valid = fullRetracementAt > deadline;
  return {
    ...base,
    status: valid ? "non_confirmation_condition_pass" : "non_confirmation_condition_fail",
    valid,
    duration,
    deadline,
    fullRetracementAt,
    reason: valid
      ? "full retracement of wave c took longer than one c-wave duration"
      : "wave c was fully retraced within one c-wave duration, so the expanding-triangle non-confirmation condition failed"
  };
}

function evaluateTruncatedFifthFollowThrough({
  stage1Confirmed,
  pattern,
  wave4,
  wave5,
  postPatternMove,
  countertrendFollowThrough,
  newExtremeBeforeFullRetracement = false
} = {}) {
  const base = {
    status: "indeterminate",
    stage: 2,
    tradable: false,
    sourceVerified: false,
    stage2Confirmed: false,
    overallPatternConfirmed: false
  };
  if (stage1Confirmed !== true) {
    return { ...base, status: "stage2_blocked", reason: "stage one must pass before truncated-fifth follow-through is evaluated" };
  }
  const validWave = (wave) => wave && Number.isFinite(wave.from?.price) &&
    Number.isFinite(wave.to?.price) && wave.from.price !== wave.to.price;
  if (typeof countertrendFollowThrough !== "boolean" ||
      typeof newExtremeBeforeFullRetracement !== "boolean" ||
      !validWave(pattern) || !validWave(wave4) || !validWave(wave5) ||
      !validWave(postPatternMove) ||
      wave5.from.price !== wave4.to.price || wave5.to.price !== pattern.to.price ||
      postPatternMove.from.price !== pattern.to.price) {
    return { ...base, reason: "finite contiguous pattern, wave-4, wave-5 and post-pattern move endpoints plus explicit qualitative follow-through flags are required" };
  }
  const patternDirection = pattern.to.price > pattern.from.price ? "up" : "down";
  const wave4Direction = wave4.to.price > wave4.from.price ? "up" : "down";
  const wave5Direction = wave5.to.price > wave5.from.price ? "up" : "down";
  const postDirection = postPatternMove.to.price > postPatternMove.from.price ? "up" : "down";
  if (wave4Direction === patternDirection || wave5Direction !== patternDirection ||
      postDirection === patternDirection) {
    return { ...base, reason: "wave 4 must oppose the impulse, wave 5 must resume it, and the post-pattern move must reverse it" };
  }
  const wave4Coverage = Math.abs(wave4.to.price - wave4.from.price);
  const wave5Coverage = Math.abs(wave5.to.price - wave5.from.price);
  if (wave5Coverage >= wave4Coverage) {
    return { ...base, status: "not_applicable", reason: "wave 5 is not shorter than wave 4; truncated-fifth rules do not apply" };
  }
  const fullPatternRetraced = patternDirection === "up"
    ? postPatternMove.to.price <= pattern.from.price
    : postPatternMove.to.price >= pattern.from.price;
  if (newExtremeBeforeFullRetracement) {
    return {
      ...base,
      status: "stage2_truncated_fifth_fail",
      wave4Coverage,
      wave5Coverage,
      fullPatternRetraced,
      reason: "a new trend extreme occurred before the entire impulse was retraced, contrary to the truncated-fifth follow-through rule"
    };
  }
  if (!fullPatternRetraced) {
    return {
      ...base,
      status: "stage2_pending",
      wave4Coverage,
      wave5Coverage,
      fullPatternRetraced: false,
      reason: "awaiting full retracement of the impulse; the source expects no new trend extreme before this occurs"
    };
  }
  if (!countertrendFollowThrough) {
    return {
      ...base,
      status: "indeterminate",
      wave4Coverage,
      wave5Coverage,
      fullPatternRetraced: true,
      reason: "the entire impulse retraced, but the source's qualitative strong-countertrend follow-through has not been established"
    };
  }
  return {
    ...base,
    status: "stage2_truncated_fifth_pass",
    stage2Confirmed: true,
    overallPatternConfirmed: false,
    wave4Coverage,
    wave5Coverage,
    fullPatternRetraced: true,
    reason: "wave 5 was shorter than wave 4, a strong countertrend follow-through was attested, and the full impulse retraced without a new trend extreme beforehand"
  };
}

function evaluateStage2Confirmation({
  patternType = "impulse",
  stage1Confirmed,
  stage1AvailableAt,
  asOfIndex,
  extendedWave,
  pattern,
  wave4,
  wave5,
  correction,
  correctionComplete = false
} = {}) {
  const base = {
    stage: 2,
    stage2Confirmed: false,
    overallPatternConfirmed: false,
    tradable: false,
    sourceVerified: false,
    causalAvailabilityVerified: false,
    availableAt: null
  };
  if (stage1Confirmed !== true) {
    return { ...base, status: "stage2_blocked", reason: "stage one must pass before stage two is evaluated" };
  }
  if (patternType !== "impulse" || ![1, 3, 5].includes(extendedWave)) {
    return { ...base, status: "indeterminate", reason: "the recovered stage-two rules apply here only to an impulse with extended wave 1, 3 or 5" };
  }
  const validWave = (wave) => wave && Number.isFinite(wave.from?.price) &&
    Number.isFinite(wave.to?.price) && wave.from.price !== wave.to.price;
  if (typeof correctionComplete !== "boolean" ||
      !validWave(pattern) || !validWave(wave4) || !validWave(wave5) ||
      !validWave(correction) || correction.from.price !== pattern.to.price ||
      wave5.from.price !== wave4.to.price || wave5.to.price !== pattern.to.price) {
    return { ...base, status: "indeterminate", reason: "correctionComplete must be boolean and pattern, wave 4, wave 5 and correction need finite, contiguous endpoints" };
  }
  const waveAvailability = (wave) => {
    if (Number.isFinite(wave.availableAt)) return wave.availableAt;
    const fromAt = wave.from.confirmedAt;
    const toAt = wave.to.confirmedAt;
    return Number.isFinite(fromAt) && Number.isFinite(toAt) ? Math.max(fromAt, toAt) : null;
  };
  const evidenceTimes = [pattern, wave4, wave5, correction].map(waveAvailability);
  const hasAsOf = Number.isInteger(asOfIndex) && asOfIndex >= 0 &&
    Number.isFinite(stage1AvailableAt);
  const futureEvidence = hasAsOf &&
    (stage1AvailableAt > asOfIndex || evidenceTimes.some((time) => Number.isFinite(time) && time > asOfIndex));
  if (futureEvidence) {
    return { ...base, status: "indeterminate", reason: "stage-one or wave evidence is later than asOfIndex" };
  }
  const causalAvailabilityVerified = hasAsOf && evidenceTimes.every(Number.isFinite);
  const availableAt = causalAvailabilityVerified
    ? Math.max(stage1AvailableAt, ...evidenceTimes) : null;
  const resultBase = { ...base, causalAvailabilityVerified, availableAt };

  const patternDirection = pattern.to.price > pattern.from.price ? "up" : "down";
  const wave4Direction = wave4.to.price > wave4.from.price ? "up" : "down";
  const wave5Direction = wave5.to.price > wave5.from.price ? "up" : "down";
  const correctionDirection = correction.to.price > correction.from.price ? "up" : "down";
  if (wave4Direction === patternDirection || wave5Direction !== patternDirection) {
    return { ...resultBase, status: "indeterminate", reason: "wave 4 must oppose the impulse direction and wave 5 must resume it" };
  }
  if (patternDirection === correctionDirection) {
    return { ...resultBase, status: "indeterminate", reason: "stage-two correction must move opposite to the completed impulse" };
  }

  const reachedWave4 = patternDirection === "up"
    ? correction.to.price <= wave4.to.price
    : correction.to.price >= wave4.to.price;
  if (extendedWave === 1 || extendedWave === 3) {
    const wholePatternRetracement = extendedWave === 3
      ? priceCoverageRatio(correction, pattern).value
      : null;
    const extensionEvidence = extendedWave === 3
      ? Number.isFinite(wholePatternRetracement) && wholePatternRetracement > 61.8
      : null;
    const confirmed = reachedWave4 && (extendedWave !== 3 || extensionEvidence === true);
    const failed = correctionComplete && !confirmed;
    return {
      ...resultBase,
      status: confirmed ? "stage2_price_target_pass" : failed ? "stage2_price_target_fail" : "stage2_pending",
      stage2Confirmed: confirmed,
      overallPatternConfirmed: confirmed && causalAvailabilityVerified,
      target: "end_of_wave_4_price_region",
      reachedTarget: reachedWave4,
      wholePatternRetracementPercent: wholePatternRetracement,
      extensionEvidence,
      correctionComplete,
      reason: confirmed
        ? extendedWave === 3
          ? "correction reached the wave-4 price region and retraced more than 61.8% of the whole pattern, supporting an extended third wave"
          : "post-pattern correction reached the wave-4 price region required for an extended first wave"
        : failed
          ? "completed correction failed the required wave-4 price-region or extended-third retracement condition"
          : "correction has not yet satisfied the required wave-4 price-region/retracement conditions"
    };
  }

  const retracement = priceCoverageRatio(correction, wave5);
  if (retracement.status !== "measured") {
    return { ...resultBase, status: "indeterminate", reason: retracement.reason };
  }
  const ratio = retracement.value;
  if (ratio >= 100) {
    return {
      ...resultBase,
      status: "stage2_price_retracement_fail",
      retracementOfWave5Percent: ratio,
      correctionComplete,
      reason: "correction fully retraced or exceeded wave 5; source says an extended fifth should not be completely retraced if the trend is to remain effective"
    };
  }
  if (ratio >= 61.8 && correctionComplete) {
    return {
      ...resultBase,
      status: "stage2_price_retracement_pass",
      stage2Confirmed: true,
      overallPatternConfirmed: causalAvailabilityVerified,
      retracementOfWave5Percent: ratio,
      correctionComplete,
      reason: "completed correction retraced at least 61.8% but less than 100% of extended wave 5"
    };
  }
  if (!correctionComplete) {
    return {
      ...resultBase,
      status: "stage2_pending",
      retracementOfWave5Percent: ratio,
      correctionComplete,
      reason: ratio < 61.8
        ? "correction has not yet retraced the required 61.8% of extended wave 5"
        : "minimum retracement reached; await correction completion to ensure wave 5 is not fully retraced"
    };
  }
  return {
    ...resultBase,
    status: "stage2_price_retracement_fail",
    retracementOfWave5Percent: ratio,
    correctionComplete,
    reason: "completed correction retraced less than 61.8% of extended wave 5"
  };
}

function evaluateStage1Confirmation({
  patternType,
  bShorterThanA,
  waveStartTime,
  waveEndTime,
  breakAt
} = {}) {
  if (!["standard", "triangle"].includes(patternType)) {
    return { status: "indeterminate", stage: 1, confirmed: false, overallPatternConfirmed: false, tradable: false, sourceVerified: false, reason: "patternType must be standard or triangle" };
  }
  if (patternType === "triangle" && bShorterThanA !== true) {
    return {
      status: "indeterminate",
      stage: 1,
      confirmed: false,
      overallPatternConfirmed: false,
      tradable: false,
      sourceVerified: false,
      reason: "the recovered 0-B / c-wave timing rule applies to triangles where wave b is shorter than wave a"
    };
  }
  if (!Number.isFinite(waveStartTime) || !Number.isFinite(waveEndTime) ||
      waveStartTime < 0 || waveEndTime <= waveStartTime) {
    return { status: "indeterminate", stage: 1, confirmed: false, overallPatternConfirmed: false, tradable: false, sourceVerified: false, reason: "a positive, ordered wave time interval is required" };
  }
  if (breakAt == null) {
    return {
      status: "pending",
      stage: 1,
      confirmed: false,
      overallPatternConfirmed: false,
      tradable: false,
      sourceVerified: false,
      referenceLine: patternType === "triangle" ? "0-B" : "2-4",
      timingWave: patternType === "triangle" ? "c" : "5",
      deadline: waveEndTime + (waveEndTime - waveStartTime),
      reason: "awaiting a confirmed break of the required reference trendline"
    };
  }
  if (!Number.isFinite(breakAt) || breakAt < waveEndTime) {
    return { status: "indeterminate", stage: 1, confirmed: false, overallPatternConfirmed: false, tradable: false, sourceVerified: false, reason: "breakAt must be a finite time at or after the timing wave ends" };
  }
  const duration = waveEndTime - waveStartTime;
  const deadline = waveEndTime + duration;
  const confirmed = breakAt <= deadline;
  return {
    status: confirmed ? "stage1_timing_pass" : "stage1_timing_fail",
    stage: 1,
    confirmed,
    overallPatternConfirmed: false,
    tradable: false,
    sourceVerified: false,
    referenceLine: patternType === "triangle" ? "0-B" : "2-4",
    timingWave: patternType === "triangle" ? "c" : "5",
    duration,
    breakAt,
    availableAt: breakAt,
    deadline,
    reason: confirmed
      ? "required trendline break occurred within one timing-wave duration after its end"
      : "trendline break exceeded the source's first-stage confirmation time window; consider an incomplete wave, terminal development, or an incorrect interpretation"
  };
}

/**
 * Parse the book's slash-separated Structure Label list notation.
 * Parenthesized/bracketed labels are retained as alternatives, not promoted
 * to equal-strength primary labels.
 */
/**
 * Parse Chapter 3 structure-sequence separators.
 * A single dash continues one standard pattern; a double plus closes one
 * standard pattern and inserts an X-wave connector before the next pattern.
 */
function parseStructureSequenceNotation(sourceNotation, { completeSeries = false } = {}) {
  if (typeof sourceNotation !== "string" || !sourceNotation.trim()) {
    return { status: "indeterminate", patterns: [], connectors: [], reason: "non-empty sequence notation is required" };
  }
  const parts = sourceNotation.trim().split(/(\+\+|-)/);
  const patterns = [{ labels: [] }];
  const connectors = [];
  let separator = null;
  let closesExplicitXWave = false;
  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;
    if (token === "-" || token === "++") {
      if (closesExplicitXWave && token === "++") {
        closesExplicitXWave = false;
        continue;
      }
      if (separator !== null || !patterns.at(-1).labels.length) {
        return { status: "indeterminate", patterns: [], connectors: [], reason: "sequence separators must occur singly after a label" };
      }
      separator = token;
      continue;
    }

    const normalized = token.toLowerCase();
    if (normalized === "x:c3") {
      if (separator !== "++") {
        return { status: "indeterminate", patterns: [], connectors: [], reason: "x:c3 must occupy an explicit ++ X-wave connector position" };
      }
      connectors.push({
        type: "X-wave",
        label: "x:c3",
        degreeExpectation: "normally_one_degree_below_both_adjacent_patterns",
        degreeExpectationEnforced: false,
        afterPattern: patterns.length - 1,
        beforePattern: patterns.length
      });
      patterns.push({ labels: [] });
      separator = null;
      closesExplicitXWave = true;
      continue;
    }

    if (separator === "++") {
      connectors.push({
        type: "X-wave",
        label: null,
        degreeExpectation: "normally_one_degree_below_both_adjacent_patterns",
        degreeExpectationEnforced: false,
        afterPattern: patterns.length - 1,
        beforePattern: patterns.length
      });
      patterns.push({ labels: [] });
      separator = null;
    } else if (separator === "-" && patterns.at(-1).labels.length === 0) {
      return { status: "indeterminate", patterns: [], connectors: [], reason: "single-dash separator cannot appear without a preceding label" };
    }

    const current = patterns.at(-1);
    if (normalized === "f3" && current.labels.length > 0) {
      const previous = current.labels.at(-1).toLowerCase();
      if (previous === "f3") {
        connectors.push({
          type: "higher-degree-start",
          label: null,
          afterPattern: patterns.length - 1,
          beforePattern: patterns.length
        });
        patterns.push({ labels: [] });
      } else if (!/(?:^|[a-z])5$/.test(previous)) {
        return { status: "indeterminate", patterns: [], connectors: [], reason: "F3 may follow an X-wave connector or a 5-wave label, but not this preceding label" };
      }
    }
    patterns.at(-1).labels.push(token);
    separator = null;
    closesExplicitXWave = false;
  }

  if (separator !== null || closesExplicitXWave || patterns.at(-1).labels.length === 0) {
    return { status: "indeterminate", patterns: [], connectors: [], reason: "sequence cannot end with a separator or X-wave connector" };
  }
  for (const pattern of patterns) {
    const labels = pattern.labels.map((label) => label.toLowerCase());
    if (labels.includes("x:c3")) {
      return { status: "indeterminate", patterns: [], connectors: [], reason: "x:c3 is a connector and cannot be a standard-pattern label" };
    }
    if (labels[0] === "c3") {
      return { status: "indeterminate", patterns: [], connectors: [], reason: "c3 cannot start a series" };
    }
    for (let i = 1; i < labels.length; i++) {
      if (labels[i] === "f3") {
        const isFive = (label) => /(?:^|[a-z])5$/.test(label);
        if (!isFive(labels[i - 1]) || !isFive(labels[i + 1] || "")) {
          return { status: "indeterminate", patterns: [], connectors: [], reason: "an internal F3 must be positioned between two 5-wave labels" };
        }
      }
    }
    if (completeSeries && (labels.at(-1) === "c3" || labels.at(-1) === "f3")) {
      return { status: "indeterminate", patterns: [], connectors: [], reason: "c3 cannot end a series and F3 must start, not end, a series" };
    }
  }
  return {
    status: "parsed_sequence_notation",
    patterns: patterns.map((pattern, index) => ({
      index,
      labels: pattern.labels,
      sourceVerified: false
    })),
    connectors,
    sourceNotation
  };
}

const STRUCTURE_LABEL_SEMANTICS = Object.freeze({
  "F3": Object.freeze({ waveForm: "three", position: "first_in_series", description: "First Three" }),
  "c3": Object.freeze({ waveForm: "three", position: "center_in_series", description: "Center Three" }),
  "x:c3": Object.freeze({ waveForm: "three", position: "center_in_x_wave", description: "Center Three in X-wave Position" }),
  "s5": Object.freeze({ waveForm: "five", position: "special_five", description: "Special Five" }),
  "L5": Object.freeze({ waveForm: "five", position: "last_in_pattern", description: "Last Five" }),
  "sL3": Object.freeze({ waveForm: "three", position: "special_last_three", description: "Special Last Three" }),
  "L3": Object.freeze({ waveForm: "three", position: "last_in_pattern", description: "Last Three" })
});

function describeStructureLabel(label) {
  if (typeof label !== "string" || !label.trim()) {
    return { status: "indeterminate", label: null, semantics: null };
  }
  const key = label.trim();
  const semantics = STRUCTURE_LABEL_SEMANTICS[key];
  return semantics
    ? { status: "known_source_label", label: key, semantics }
    : { status: "unclassified_label", label: key, semantics: null };
}

function detectPatternBoundaryMarkers(labels) {
  if (!Array.isArray(labels) || !labels.length || labels.some((label) => typeof label !== "string")) {
    return { status: "indeterminate", boundaries: [], reason: "a non-empty array of Structure Labels is required" };
  }
  const boundaries = [];
  labels.forEach((label, index) => {
    const semantics = describeStructureLabel(label).semantics;
    if (semantics && ["last_in_pattern", "special_last_three"].includes(semantics.position)) {
      boundaries.push({
        index,
        label,
        boundaryType: semantics.position === "special_last_three"
          ? "special_corrective_pattern_end" : semantics.waveForm + "_pattern_end"
      });
    }
  });
  return {
    status: boundaries.length ? "boundary_markers_found" : "no_boundary_marker",
    boundaries,
    sourceVerified: false
  };
}

function segmentPatternLabels(labels) {
  if (!Array.isArray(labels) || !labels.length || labels.some((label) => typeof label !== "string")) {
    return { status: "indeterminate", completedPatterns: [], openTail: [], reason: "a non-empty array of Structure Labels is required" };
  }
  const completedPatterns = [];
  let current = [];
  labels.forEach((label) => {
    current.push(label);
    const semantics = describeStructureLabel(label).semantics;
    if (semantics && ["last_in_pattern", "special_last_three"].includes(semantics.position)) {
      completedPatterns.push({
        index: completedPatterns.length,
        labels: current,
        endMarker: label,
        sourceVerified: false
      });
      current = [];
    }
  });
  return {
    status: completedPatterns.length ? "candidate_patterns_segmented" : "no_completed_pattern_boundary",
    completedPatterns,
    openTail: current,
    sourceVerified: false
  };
}

function aggregatePolywaveCandidate({ patterns, xWaves, asOfIndex } = {}) {
  const fail = (reason) => ({
    status: "indeterminate",
    kind: "candidate_polywave",
    tradable: false,
    sourceVerified: false,
    reason
  });
  if (!Array.isArray(patterns) || patterns.length < 2 ||
      !Array.isArray(xWaves) || xWaves.length !== patterns.length - 1) {
    return fail("a polywave candidate requires at least two patterns and exactly one X-wave connector between each adjacent pair");
  }
  const validComponent = (component) => component && component.from && component.to &&
    Number.isInteger(component.from.index) && Number.isInteger(component.to.index) &&
    component.from.index >= 0 && component.to.index > component.from.index &&
    Number.isFinite(component.from.price) && Number.isFinite(component.to.price) &&
    component.from.price !== component.to.price;
  if (patterns.some((pattern) => !validComponent(pattern)) ||
      xWaves.some((xWave) => !validComponent(xWave))) {
    return fail("every pattern and X-wave needs ordered source indices and distinct finite endpoint prices");
  }
  for (let i = 0; i < xWaves.length; i++) {
    if (patterns[i].to.index !== xWaves[i].from.index ||
        patterns[i].to.price !== xWaves[i].from.price ||
        xWaves[i].to.index !== patterns[i + 1].from.index ||
        xWaves[i].to.price !== patterns[i + 1].from.price) {
      return fail("patterns and X-waves must be exactly contiguous at shared endpoints");
    }
  }
  if (asOfIndex !== undefined && (!Number.isInteger(asOfIndex) || asOfIndex < 0)) {
    return fail("asOfIndex must be a non-negative integer when supplied");
  }
  const components = [...patterns, ...xWaves];
  const availability = components.map((component) => {
    if (Number.isFinite(component.availableAt)) return component.availableAt;
    const fromAt = component.from.confirmedAt;
    const toAt = component.to.confirmedAt;
    return Number.isFinite(fromAt) && Number.isFinite(toAt) ? Math.max(fromAt, toAt) : null;
  });
  if (Number.isInteger(asOfIndex) && availability.some((time) => Number.isFinite(time) && time > asOfIndex)) {
    return fail("polywave evidence contains a component confirmed after asOfIndex");
  }
  const causalAvailabilityVerified = availability.every(Number.isFinite);
  const availableAt = causalAvailabilityVerified ? Math.max(...availability) : null;
  const first = patterns[0].from;
  const last = patterns.at(-1).to;
  const priceCoverage = Math.abs(last.price - first.price);
  const duration = last.index - first.index;
  const degreeDiagnostics = xWaves.map((xWave, index) => {
    if (!patterns[index].degree || !patterns[index + 1].degree || !xWave.degree) return null;
    return assessXWaveDegreeRelation({
      leftPatternDegree: patterns[index].degree,
      rightPatternDegree: patterns[index + 1].degree,
      xWaveDegree: xWave.degree,
      documentedException: xWave.documentedDegreeException === true
    });
  }).filter(Boolean);
  return {
    status: "candidate_polywave",
    kind: "candidate_polywave",
    complete: false,
    tradable: false,
    sourceVerified: false,
    patterns: patterns.length,
    xWaveCount: xWaves.length,
    from: first,
    to: last,
    direction: last.price > first.price ? "up" : last.price < first.price ? "down" : "flat",
    priceCoverage,
    duration,
    barsPerPriceUnit: priceCoverage > 0 ? duration / priceCoverage : null,
    availableAt,
    causalAvailabilityVerified,
    degreeDiagnostics,
    disclaimer: "This aggregates contiguous component structures only. It does not validate component pattern families, X-wave price/time rules, or the full NeoWave polywave decision tree."
  };
}

function analyzeStructureSequenceNotation(sourceNotation, options = {}) {
  const parsed = parseStructureSequenceNotation(sourceNotation, options);
  if (parsed.status !== "parsed_sequence_notation") {
    return { status: "indeterminate", patterns: [], connectors: [], tradable: false, reason: parsed.reason };
  }
  const patterns = parsed.patterns.map((pattern) => ({
    ...pattern,
    segmentation: segmentPatternLabels(pattern.labels)
  }));
  return {
    status: parsed.connectors.length ? "polywave_candidate" : "single_pattern_candidate",
    tradable: false,
    sourceVerified: false,
    patterns,
    connectors: parsed.connectors,
    completePatternCount: patterns.reduce((count, pattern) =>
      count + pattern.segmentation.completedPatterns.length, 0),
    disclaimer: "Sequence notation only; this does not validate the component pattern families, their price/time rules, or the complete polywave."
  };
}

function parseStructureLabelList(sourceNotation) {
  if (typeof sourceNotation !== "string" || !sourceNotation.trim()) {
    return { status: "indeterminate", candidates: [], reason: "a non-empty source notation is required" };
  }
  let body = sourceNotation.trim();
  if (body.startsWith("{") && body.endsWith("}")) body = body.slice(1, -1);
  const tokens = body.split("/").map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) {
    return { status: "indeterminate", candidates: [], reason: "no Structure Label tokens were found" };
  }
  const candidates = tokens.map((raw) => {
    const parenthesized = raw.startsWith("(") && raw.endsWith(")");
    const bracketed = raw.startsWith("[") && raw.endsWith("]");
    const wrapped = parenthesized || bracketed;
    return {
      label: wrapped ? raw.slice(1, -1).trim() : raw,
      notation: parenthesized ? "parenthesized" : bracketed ? "bracketed" : "unwrapped",
      role: parenthesized ? "lower_probability_alternative"
        : bracketed ? "rare_or_very_unlikely" : "primary_candidate",
      rank: parenthesized ? "conditional" : bracketed ? "rare" : "primary",
      semantics: describeStructureLabel(wrapped ? raw.slice(1, -1).trim() : raw).semantics,
      primary: !wrapped,
      raw
    };
  });
  if (candidates.some((candidate) => !candidate.label)) {
    return { status: "indeterminate", candidates: [], reason: "empty Structure Label token in source notation" };
  }
  return { status: "parsed_source_notation", candidates, sourceNotation };
}

// Partial, visually transcribed Structure Label seeds. These are not full
// Pre-Constructive predicates; all untranscribed conditions remain blocked.
const PRECONSTRUCTIVE_SEEDS = Object.freeze({
  "1:a": Object.freeze({
    notation: "{5/(c3)/(x:c3)/[sL3]/[s5]}",
    source: Object.freeze({ document: "Mastering Elliott Wave", locator: "Chapter 3, scan PDF p. 95, Rule 1 Condition a" })
  }),
  "2:a": Object.freeze({
    notation: "{5/(sL3)/[c3]/[s5]}",
    source: Object.freeze({ document: "Mastering Elliott Wave", locator: "Chapter 3, scan PDF p. 96, Rule 2 Condition a" })
  }),
  "3:a": Object.freeze({
    notation: "{F3/c3/s5/5/(sL3)/[L5]}",
    source: Object.freeze({ document: "Mastering Elliott Wave", locator: "Chapter 3, scan PDF p. 106, Rule 3 Condition a" })
  })
});

function getPreconstructiveSeed(ruleNumber, condition) {
  const seed = PRECONSTRUCTIVE_SEEDS[String(ruleNumber) + ":" + String(condition).toLowerCase()];
  if (!seed) {
    return {
      status: "indeterminate",
      tradable: false,
      reason: "no visually verified Structure Label seed is available for this Rule/Condition"
    };
  }
  return {
    status: "partial_source_seed",
    tradable: false,
    sourceVerified: false,
    ruleNumber,
    condition: String(condition).toLowerCase(),
    ...seed,
    labels: parseStructureLabelList(seed.notation).candidates,
    conditionsEvaluated: false,
    completeness: "partial_not_executable_rule"
  };
}

function hypothesesFromPreconstructiveSeed(seed, { evidence = [], conditions = [] } = {}) {
  if (!seed || seed.status !== "partial_source_seed" ||
      !Array.isArray(seed.labels) || !seed.labels.length ||
      !Array.isArray(evidence) || !Array.isArray(conditions)) {
    return { status: "indeterminate", candidates: [], reason: "a valid partial source seed and evidence/condition arrays are required" };
  }
  return {
    status: "candidate_hypotheses",
    complete: false,
    tradable: false,
    candidates: seed.labels.map((label) => ({
      label: label.label,
      rank: label.rank,
      source: seed.source,
      evidence,
      conditions
    }))
  };
}

/**
 * Append one time-causal snapshot of competing Structure Label hypotheses.
 * This is a ledger, not a pattern classifier: source rules decide labels;
 * later evidence creates a new revision rather than rewriting earlier ones.
 */
function createHypothesisRevision({ history = [], asOfIndex, candidates = [] } = {}) {
  if (!Array.isArray(history) || !Number.isInteger(asOfIndex) || asOfIndex < 0 ||
      !Array.isArray(candidates)) {
    throw Error("history, non-negative asOfIndex and candidates are required");
  }
  const previous = history.at(-1);
  if (previous && (!Number.isInteger(previous.asOfIndex) || asOfIndex <= previous.asOfIndex)) {
    throw Error("hypothesis revisions must advance strictly in asOfIndex");
  }

  const normalized = candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" ||
        typeof candidate.label !== "string" || !candidate.label.trim() ||
        !["primary", "conditional", "rare"].includes(candidate.rank) ||
        !candidate.source || typeof candidate.source.document !== "string" ||
        !candidate.source.document.trim() ||
        typeof candidate.source.locator !== "string" || !candidate.source.locator.trim() ||
        !Array.isArray(candidate.evidence) || !Array.isArray(candidate.conditions)) {
      throw Error("Invalid hypothesis candidate at index " + index);
    }

    const evidence = candidate.evidence.map((item, evidenceIndex) => {
      if (!item || typeof item.id !== "string" || !item.id.trim() ||
          !Number.isInteger(item.availableAt) || item.availableAt < 0 ||
          item.availableAt > asOfIndex) {
        throw Error("Invalid or future evidence at candidate " + index + ", evidence " + evidenceIndex);
      }
      return { id: item.id, availableAt: item.availableAt };
    });

    const conditions = candidate.conditions.map((condition, conditionIndex) => {
      if (!condition || typeof condition.id !== "string" || !condition.id.trim() ||
          !["pass", "fail", "indeterminate"].includes(condition.status)) {
        throw Error("Invalid condition at candidate " + index + ", condition " + conditionIndex);
      }
      return { id: condition.id, status: condition.status };
    });

    const rejected = conditions.some((condition) => condition.status === "fail");
    const unresolved = conditions.length === 0 || conditions.some((condition) => condition.status === "indeterminate");
    return Object.freeze({
      label: candidate.label.trim(),
      rank: candidate.rank,
      status: rejected ? "rejected" : unresolved ? "conditional" : "supported",
      source: Object.freeze({
        document: candidate.source.document,
        locator: candidate.source.locator
      }),
      evidence: Object.freeze(evidence),
      conditions: Object.freeze(conditions),
      availableAt: evidence.length ? Math.max(...evidence.map((item) => item.availableAt)) : null
    });
  });

  const revision = Object.freeze({
    revision: history.length + 1,
    asOfIndex,
    candidates: Object.freeze(normalized)
  });
  const nextHistory = Object.freeze([...history, revision]);
  return Object.freeze({ history: nextHistory, latest: revision });
}

function createDegreeAssignmentRevision({ history = [], asOfIndex, assignments = [] } = {}) {
  if (!Array.isArray(history) || !Number.isInteger(asOfIndex) || asOfIndex < 0 ||
      !Array.isArray(assignments)) {
    throw Error("history, non-negative asOfIndex and assignments are required");
  }
  const previous = history.at(-1);
  if (previous && (!Number.isInteger(previous.asOfIndex) || asOfIndex <= previous.asOfIndex)) {
    throw Error("degree-assignment revisions must advance strictly in asOfIndex");
  }
  const previousById = new Map((previous?.assignments || []).map((item) => [item.structureId, item]));
  const seen = new Set();
  const normalized = assignments.map((assignment, index) => {
    if (!assignment || typeof assignment.structureId !== "string" ||
        !assignment.structureId.trim() || seen.has(assignment.structureId) ||
        degreeIndex(assignment.degree) < 0 ||
        !assignment.source || typeof assignment.source.document !== "string" ||
        !assignment.source.document.trim() ||
        typeof assignment.source.locator !== "string" ||
        !assignment.source.locator.trim() ||
        !Array.isArray(assignment.evidence)) {
      throw Error("Invalid degree assignment at index " + index);
    }
    seen.add(assignment.structureId);
    const prior = previousById.get(assignment.structureId);
    if (prior && prior.degree !== assignment.degree &&
        (typeof assignment.recountReason !== "string" || !assignment.recountReason.trim())) {
      throw Error("a changed degree assignment requires an explicit recountReason");
    }
    const evidence = assignment.evidence.map((item, evidenceIndex) => {
      if (!item || typeof item.id !== "string" || !item.id.trim() ||
          !Number.isInteger(item.availableAt) || item.availableAt < 0 ||
          item.availableAt > asOfIndex) {
        throw Error("Invalid or future degree evidence at assignment " + index + ", evidence " + evidenceIndex);
      }
      return { id: item.id, availableAt: item.availableAt };
    });
    return Object.freeze({
      structureId: assignment.structureId.trim(),
      degree: assignment.degree,
      degreeIndex: degreeIndex(assignment.degree),
      status: evidence.length ? "assigned" : "conditional",
      source: Object.freeze({
        document: assignment.source.document,
        locator: assignment.source.locator
      }),
      evidence: Object.freeze(evidence),
      availableAt: evidence.length ? Math.max(...evidence.map((item) => item.availableAt)) : null,
      recountReason: assignment.recountReason?.trim() || null,
      sourceVerified: false
    });
  });
  const revision = Object.freeze({
    revision: history.length + 1,
    asOfIndex,
    assignments: Object.freeze(normalized)
  });
  const nextHistory = Object.freeze([...history, revision]);
  return Object.freeze({ history: nextHistory, latest: revision });
}

/*
 * Rule-definition contract:
 * {
 *   id: catalog rule ID,
 *   sourceVerified: true,                 // human-reviewed against the cited source
 *   source: { document: string, locator: string },
 *   applies(candidate): { status: "applies" } |
 *                       { status: "not_applicable", reason: string },
 *   evaluate(candidate): { status: "pass" } | { status: "fail"|"indeterminate", reason: string }
 * }
 *
 * Applicability is rule- and pattern-specific. A rule is not required to apply to
 * every candidate, but every catalog entry must be source-verified before the
 * engine can be certified. Unknown applicability always fails closed.
 */
function validateNeoWaveCandidate(candidate, { ruleDefinitions = [] } = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {
      status: "rejected",
      tradable: false,
      missingRules: [],
      failedRules: [{ id: "CANDIDATE", status: "invalid", reason: "candidate must be an object" }]
    };
  }

  if (!Array.isArray(ruleDefinitions)) {
    throw Error("ruleDefinitions must be an array");
  }

  // Caller-supplied callbacks and provenance are useful for isolated tests,
  // but must never certify the production engine.
  if (!ENGINE_CERTIFICATION.complete ||
      !ENGINE_CERTIFICATION.sourceReviewed ||
      !ENGINE_CERTIFICATION.independentRuleTests) {
    return {
      status: "blocked_incomplete_rulebook",
      tradable: false,
      missingRules: RULE_CATALOG.map((rule) => rule.id),
      failedRules: [],
      certification: ENGINE_CERTIFICATION
    };
  }

  const definitions = new Map(ruleDefinitions.map((definition) => [definition.id, definition]));
  const required = RULE_CATALOG.filter((rule) => rule.requiredForEngineCertification);
  const missing = required.filter((rule) => {
    const definition = definitions.get(rule.id);
    return !definition ||
      definition.sourceVerified !== true ||
      !definition.source ||
      typeof definition.source.document !== "string" ||
      !definition.source.document.trim() ||
      typeof definition.source.locator !== "string" ||
      !definition.source.locator.trim() ||
      typeof definition.applies !== "function" ||
      typeof definition.evaluate !== "function";
  });

  if (missing.length) {
    return {
      status: "blocked_incomplete_rulebook",
      tradable: false,
      missingRules: missing.map((rule) => rule.id),
      failedRules: []
    };
  }

  const failed = [];
  let applicableCount = 0;

  for (const rule of required) {
    const definition = definitions.get(rule.id);
    let applicability;

    try {
      applicability = definition.applies(candidate);
    } catch (error) {
      applicability = {
        status: "indeterminate",
        reason: String(error.message || error)
      };
    }

    if (applicability?.status === "not_applicable" &&
        typeof applicability.reason === "string" &&
        applicability.reason.trim()) {
      continue;
    }

    if (applicability?.status !== "applies") {
      failed.push({
        id: rule.id,
        status: "indeterminate",
        reason: applicability?.reason || "rule applicability was not established"
      });
      continue;
    }

    applicableCount++;
    let result;
    try {
      result = definition.evaluate(candidate);
    } catch (error) {
      result = {
        status: "error",
        reason: String(error.message || error)
      };
    }

    if (result?.status !== "pass") {
      failed.push({
        id: rule.id,
        status: result?.status || "indeterminate",
        reason: result?.reason || "applicable rule did not pass"
      });
    }
  }

  if (applicableCount === 0) {
    failed.push({
      id: "APPLICABILITY",
      status: "indeterminate",
      reason: "no catalog rule was established as applicable to this candidate"
    });
  }

  if (failed.length) {
    return {
      status: "rejected",
      tradable: false,
      missingRules: [],
      failedRules: failed
    };
  }

  return {
    status: "validated",
    tradable: true,
    missingRules: [],
    failedRules: []
  };
}

function analyze(bars, options = {}) {
  const pivots = confirmedPivots(bars, options);
  const waves = monowaves(pivots);
  const structure = summarizeStructure(waves);
  const neoWaveGate = validateNeoWaveCandidate(
    { pivots, waves, structure },
    options
  );
  return {
    asOfIndex: bars.length - 1,
    pivotMethod: "symmetric_fractal_candidate_not_Neely_Rules_of_Observation",
    sourceObservationRulesApplied: false,
    patternStatus: "not_evaluated",
    pivots,
    waves,
    structure,
    neoWaveGate,
    disclaimer: "The fixed-window fractal pivots and resulting wave segments are heuristic candidates, not source-verified NeoWave monowaves. Rules of Observation, grouping, pattern construction and confirmation are not complete. No candidate is tradable."
  };
}

function analyzeNeoWaveRetracement(context) {
  const measured = analyzeRetracementContext(context);
  if (!Array.isArray(measured.candidates)) {
    return { ...measured, preconstructiveStatus: "indeterminate", tradable: false };
  }
  const candidates = measured.candidates.map((candidate) => {
    const ruleNumber = Number(candidate.ruleId.slice(-2));
    const conditionLetter = candidate.condition?.condition;
    const seed = conditionLetter
      ? getPreconstructiveSeed(ruleNumber, conditionLetter)
      : { status: "indeterminate", tradable: false, reason: "retracement condition is not established" };
    const hypotheses = seed.status === "partial_source_seed"
      ? hypothesesFromPreconstructiveSeed(seed, {
          conditions: [{ id: "full_preconstructive_decision_tree", status: "indeterminate" }]
        })
      : { status: "indeterminate", candidates: [], reason: seed.reason };
    return { ...candidate, structureLabelSeed: seed, structureLabelHypotheses: hypotheses };
  });
  const allHaveSeeds = candidates.every((candidate) =>
    candidate.structureLabelSeed.status === "partial_source_seed");
  return {
    ...measured,
    candidates,
    preconstructiveStatus: allHaveSeeds ? "partial_source_seed" : "incomplete_source_mapping",
    tradable: false,
    disclaimer: "Retracement diagnostics and partial label seeds are not the full Pre-Constructive decision tree; candidate labels remain unconfirmed."
  };
}

module.exports = {
  RULE_CATALOG,
  DEGREE_HIERARCHY,
  degreeIndex,
  compareDegrees,
  assessXWaveDegreeRelation,
  STRUCTURE_LABEL_SEMANTICS,
  describeStructureLabel,
  detectPatternBoundaryMarkers,
  segmentPatternLabels,
  parseStructureLabelList,
  parseStructureSequenceNotation,
  analyzeStructureSequenceNotation,
  aggregatePolywaveCandidate,
  PRECONSTRUCTIVE_SEEDS,
  getPreconstructiveSeed,
  hypothesesFromPreconstructiveSeed,
  ENGINE_CERTIFICATION,
  confirmedPivots,
  monowaves,
  aggregateMonowaveGroup,
  summarizeStructure,
  evaluateFiveSectionGuidelines,
  evaluateStage1Confirmation,
  evaluateStage2Confirmation,
  evaluateTriangleLongBStage1,
  evaluateTriangleLongBStage2,
  evaluateTrianglePatternTypeStage1,
  evaluateExpandingTriangleNonConfirmation,
  evaluateTruncatedFifthFollowThrough,
  createHypothesisRevision,
  createDegreeAssignmentRevision,
  validateNeoWaveCandidate,
  analyze,
  analyzeRetracementContext,
  priceCoverageRatio,
  timeCoverageRatio,
  analyzeNeoWaveRetracement
};
