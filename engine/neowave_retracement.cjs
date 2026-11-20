"use strict";

// Source-backed Chapter 3 measurements only. This module deliberately does not
// convert a retracement activation into a Structure Label or a completed pattern.
// Source notes: research/NEOWAVE_RETRACEMENT_RULES_EXTRACTION_V1.md
// Printed Chapter 3 pp. 3-23–3-30 (scan PDF pp. 34–38); Pre-Constructive
// tolerance discussion begins printed p. 3-33 (scan PDF p. 40).

const SOURCE = Object.freeze({
  document: "Glenn Neely, Mastering Elliott Wave, Version 2.0",
  activation: "Chapter 3, printed pp. 3-23–3-30; scan PDF pp. 34–38",
  tolerance: "Chapter 3, printed p. 3-33; scan PDF p. 40"
});

const FIB = Object.freeze({
  RATIO_38_2: 38.2,
  RATIO_61_8: 61.8,
  RATIO_100: 100,
  RATIO_161_8: 161.8,
  RATIO_261_8: 261.8,
  RULE_3_TOLERANCE_LOW: 58,
  RULE_3_TOLERANCE_HIGH: 66
});

const CONDITION_BANDS = Object.freeze({
  1: [
    { condition: "a", min: -Infinity, max: 61.8, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 61.8, max: 100, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 100, max: 161.8, minInclusive: true, maxInclusive: true },
    { condition: "d", min: 161.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ],
  2: [
    { condition: "a", min: -Infinity, max: 38.2, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 38.2, max: 61.8, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 61.8, max: 100, minInclusive: true, maxInclusive: false },
    { condition: "d", min: 100, max: 161.8, minInclusive: true, maxInclusive: true },
    { condition: "e", min: 161.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ],
  3: [
    { condition: "a", min: -Infinity, max: 38.2, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 38.2, max: 61.8, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 61.8, max: 100, minInclusive: true, maxInclusive: false },
    { condition: "d", min: 100, max: 161.8, minInclusive: true, maxInclusive: false },
    { condition: "e", min: 161.8, max: 261.8, minInclusive: true, maxInclusive: true },
    { condition: "f", min: 261.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ],
  4: [
    { condition: "a", min: -Infinity, max: 38.2, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 38.2, max: 100, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 100, max: 161.8, minInclusive: true, maxInclusive: false },
    { condition: "d", min: 161.8, max: 261.8, minInclusive: true, maxInclusive: true },
    { condition: "e", min: 261.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ],
  5: [
    { condition: "a", min: -Infinity, max: 100, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 100, max: 161.8, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 161.8, max: 261.8, minInclusive: true, maxInclusive: true },
    { condition: "d", min: 261.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ],
  6: [
    { condition: "a", min: -Infinity, max: 100, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 100, max: 161.8, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 161.8, max: 261.8, minInclusive: true, maxInclusive: true },
    { condition: "d", min: 261.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ],
  7: [
    { condition: "a", min: -Infinity, max: 100, minInclusive: false, maxInclusive: false },
    { condition: "b", min: 100, max: 161.8, minInclusive: true, maxInclusive: false },
    { condition: "c", min: 161.8, max: 261.8, minInclusive: true, maxInclusive: true },
    { condition: "d", min: 261.8, max: Infinity, minInclusive: false, maxInclusive: false }
  ]
});

function endpointPrices(wave) {
  if (!wave || typeof wave !== "object") return null;
  const start = Number.isFinite(wave.from?.price) ? wave.from.price
    : Number.isFinite(wave.startPrice) ? wave.startPrice
    : Number.isFinite(wave.start) ? wave.start : null;
  const end = Number.isFinite(wave.to?.price) ? wave.to.price
    : Number.isFinite(wave.endPrice) ? wave.endPrice
    : Number.isFinite(wave.end) ? wave.end : null;
  if (start === null || end === null || start === end) return null;
  return { start, end, coverage: Math.abs(end - start) };
}

function availabilityOf(wave) {
  if (!wave || typeof wave !== "object") return null;
  if (Number.isFinite(wave.availableAt)) return wave.availableAt;
  const fromAt = wave.from?.confirmedAt;
  const toAt = wave.to?.confirmedAt;
  return Number.isFinite(fromAt) && Number.isFinite(toAt)
    ? Math.max(fromAt, toAt) : null;
}

function priceCoverageRatio(numeratorWave, denominatorWave) {
  const numerator = endpointPrices(numeratorWave);
  const denominator = endpointPrices(denominatorWave);
  if (!numerator || !denominator || denominator.coverage === 0) {
    return { status: "indeterminate", value: null, reason: "both waves need distinct, finite termination prices and the denominator must be non-zero" };
  }
  return {
    status: "measured",
    value: numerator.coverage / denominator.coverage * 100,
    numeratorCoverage: numerator.coverage,
    denominatorCoverage: denominator.coverage,
    availableAt: Number.isFinite(availabilityOf(numeratorWave)) && Number.isFinite(availabilityOf(denominatorWave))
      ? Math.max(availabilityOf(numeratorWave), availabilityOf(denominatorWave)) : null,
    causalAvailabilityVerified: Number.isFinite(availabilityOf(numeratorWave)) && Number.isFinite(availabilityOf(denominatorWave))
  };
}

function inBand(value, band) {
  return (value > band.min || (band.minInclusive && value === band.min)) &&
    (value < band.max || (band.maxInclusive && value === band.max));
}

function classifyRetracementActivation(m2OverM1Percent) {
  if (!Number.isFinite(m2OverM1Percent) || m2OverM1Percent < 0) {
    return { status: "indeterminate", ruleIds: [], reason: "m2/m1 must be a finite non-negative percentage" };
  }

  const v = m2OverM1Percent;
  const baseline = v < 38.2 ? 1
    : v < 61.8 ? 2
    : v === 61.8 ? 3
    : v < 100 ? 4
    : v < 161.8 ? 5
    : v <= 261.8 ? 6 : 7;

  // Rule 3 is called exactly 61.8% in the activation table, but the following
  // logic section gives 58–66% as an example tolerance. Do not silently choose
  // one interpretation: surface both the nominal band and Rule-3 ambiguity.
  const inRule3Tolerance = v >= FIB.RULE_3_TOLERANCE_LOW &&
    v <= FIB.RULE_3_TOLERANCE_HIGH;
  if (inRule3Tolerance && v !== 61.8) {
    const ids = [baseline, 3].map(n => "NW-RET-" + String(n).padStart(2, "0"));
    return {
      status: "ambiguous_source_tolerance",
      ruleIds: [...new Set(ids)],
      nominalRuleId: "NW-RET-" + String(baseline).padStart(2, "0"),
      reason: "Rule 3 is stated as exactly 61.8%, while the source's general Fibonacci tolerance example treats 61.8% as approximately 58–66%; resolve with full context before selecting one rule.",
      source: SOURCE
    };
  }
  return {
    status: "classified_activation_only",
    ruleIds: ["NW-RET-" + String(baseline).padStart(2, "0")],
    reason: "Activation band only; this does not produce a Structure Label or validate a pattern.",
    source: SOURCE
  };
}

function classifyCondition(ruleNumber, m0OverM1Percent) {
  const bands = CONDITION_BANDS[ruleNumber];
  if (!bands || !Number.isFinite(m0OverM1Percent) || m0OverM1Percent < 0) {
    return { status: "indeterminate", condition: null, reason: "known rule number and finite non-negative m0/m1 percentage are required" };
  }
  const matches = bands.filter(b => inBand(m0OverM1Percent, b));
  if (matches.length !== 1) {
    return { status: "indeterminate", condition: null, reason: matches.length ? "overlapping condition boundaries in extracted source map" : "no condition band matched; source boundary semantics require review" };
  }
  return {
    status: "classified_condition_only",
    condition: matches[0].condition,
    ruleId: "NW-RET-" + String(ruleNumber).padStart(2, "0"),
    reason: "Condition identifier only; Pre-Constructive Logic is required to derive Structure Label hypotheses.",
    source: SOURCE
  };
}

function classifyRule4Category(m3OverM2Percent) {
  if (!Number.isFinite(m3OverM2Percent) || m3OverM2Percent < 0) {
    return { status: "indeterminate", category: null, reason: "finite non-negative m3/m2 percentage is required" };
  }
  const v = m3OverM2Percent;
  if (v >= 100 && v < 161.8) return { status: "classified_category_only", category: "i", source: SOURCE };
  if (v >= 161.8 && v <= 261.8) return { status: "classified_category_only", category: "ii", source: SOURCE };
  if (v > 261.8) return { status: "classified_category_only", category: "iii", source: SOURCE };
  return { status: "indeterminate", category: null, reason: "the extracted Rule 4 category map starts at 100%; below 100% is not defined in the current source note" };
}

function analyzeRetracementContext({ m0, m1, m2, m3 } = {}) {
  const m2m1 = priceCoverageRatio(m2, m1);
  if (m2m1.status !== "measured") {
    return { status: "indeterminate", tradable: false, reason: m2m1.reason, source: SOURCE };
  }
  const activation = classifyRetracementActivation(m2m1.value);
  const candidates = activation.ruleIds.map(ruleId => {
    const ruleNumber = Number(ruleId.slice(-2));
    const m0m1 = priceCoverageRatio(m0, m1);
    const condition = m0m1.status === "measured"
      ? { ...classifyCondition(ruleNumber, m0m1.value), availableAt: m0m1.availableAt, causalAvailabilityVerified: m0m1.causalAvailabilityVerified }
      : { status: "indeterminate", condition: null, reason: m0m1.reason, availableAt: null, causalAvailabilityVerified: false };
    let category = null;
    if (ruleNumber === 4) {
      const m3m2 = priceCoverageRatio(m3, m2);
      category = m3m2.status === "measured"
        ? { ...classifyRule4Category(m3m2.value), availableAt: m3m2.availableAt, causalAvailabilityVerified: m3m2.causalAvailabilityVerified }
        : { status: "indeterminate", category: null, reason: m3m2.reason, availableAt: null, causalAvailabilityVerified: false };
    }
    return { ruleId, m0OverM1Percent: m0m1.value, condition, category };
  });
  return {
    status: activation.status === "ambiguous_source_tolerance" ? activation.status
      : candidates.every(x => x.condition.status === "classified_condition_only" &&
        (x.ruleId !== "NW-RET-04" || x.category?.status === "classified_category_only"))
        ? "activation_and_condition_measured" : "partially_measured",
    tradable: false,
    m2OverM1Percent: m2m1.value,
    activation,
    candidates,
    availableAt: [m2m1, ...candidates.flatMap(x => [x.condition, x.category].filter(Boolean))]
      .every(x => Number.isFinite(x.availableAt))
      ? Math.max(m2m1.availableAt, ...candidates.flatMap(x => [x.condition, x.category].filter(Boolean).map(y => y.availableAt))) : null,
    causalAvailabilityVerified: Number.isFinite(m2m1.availableAt) &&
      candidates.every(x => x.condition?.causalAvailabilityVerified === true &&
        (x.ruleId !== "NW-RET-04" || x.category?.causalAvailabilityVerified === true)),
    source: SOURCE,
    disclaimer: "These measurements only identify retracement-rule activation and letter/category identifiers. They do not implement the Pre-Constructive Structure Label decision tree, pattern construction, completion, confirmation, invalidation, or recount."
  };
}

module.exports = {
  SOURCE,
  FIB,
  CONDITION_BANDS,
  priceCoverageRatio,
  availabilityOf,
  classifyRetracementActivation,
  classifyCondition,
  classifyRule4Category,
  analyzeRetracementContext
};
