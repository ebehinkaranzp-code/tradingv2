"use strict";

const { analyzeRetracementContext } = require("./neowave_retracement.cjs");

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
function evaluateFiveSectionGuidelines(sections) {
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
  return {
    status,
    tradable: false,
    source: { document: "Mastering Elliott Wave", locator: "Chapter 5, printed p. 5-3, Necessary Structural Rules" },
    checks,
    measurements: metrics,
    disclaimer: "This checklist is necessary-conditions diagnostics only; it does not identify a pattern family or establish completion/confirmation."
  };
}

/**
 * Chapter 6 first-stage confirmation timing diagnostic.
 * A trendline break is supplied by the caller's independently checked
 * price/bar analysis; this function only evaluates the source's time window.
 */
function evaluateStage1Confirmation({
  patternType,
  waveStartTime,
  waveEndTime,
  breakAt
} = {}) {
  if (!["standard", "triangle"].includes(patternType)) {
    return { status: "indeterminate", stage: 1, confirmed: false, reason: "patternType must be standard or triangle" };
  }
  if (!Number.isFinite(waveStartTime) || !Number.isFinite(waveEndTime) ||
      waveStartTime < 0 || waveEndTime <= waveStartTime) {
    return { status: "indeterminate", stage: 1, confirmed: false, reason: "a positive, ordered wave time interval is required" };
  }
  if (breakAt == null) {
    return {
      status: "pending",
      stage: 1,
      confirmed: false,
      referenceLine: patternType === "triangle" ? "0-B" : "2-4",
      timingWave: patternType === "triangle" ? "c" : "5",
      deadline: waveEndTime + (waveEndTime - waveStartTime),
      reason: "awaiting a confirmed break of the required reference trendline"
    };
  }
  if (!Number.isFinite(breakAt) || breakAt < waveEndTime) {
    return { status: "indeterminate", stage: 1, confirmed: false, reason: "breakAt must be a finite time at or after the timing wave ends" };
  }
  const duration = waveEndTime - waveStartTime;
  const deadline = waveEndTime + duration;
  const confirmed = breakAt <= deadline;
  return {
    status: confirmed ? "stage1_confirmed" : "stage1_not_confirmed",
    stage: 1,
    confirmed,
    referenceLine: patternType === "triangle" ? "0-B" : "2-4",
    timingWave: patternType === "triangle" ? "c" : "5",
    duration,
    breakAt,
    deadline,
    reason: confirmed
      ? "required trendline break occurred within one timing-wave duration after its end"
      : "trendline break exceeded the source's first-stage confirmation time window; consider an incomplete wave, terminal development, or an incorrect interpretation"
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
        !["primary", "conditional"].includes(candidate.rank) ||
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
    const unresolved = conditions.some((condition) => condition.status === "indeterminate");
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

module.exports = {
  RULE_CATALOG,
  DEGREE_HIERARCHY,
  degreeIndex,
  compareDegrees,
  ENGINE_CERTIFICATION,
  confirmedPivots,
  monowaves,
  aggregateMonowaveGroup,
  summarizeStructure,
  evaluateFiveSectionGuidelines,
  evaluateStage1Confirmation,
  createHypothesisRevision,
  validateNeoWaveCandidate,
  analyze,
  analyzeRetracementContext
};
