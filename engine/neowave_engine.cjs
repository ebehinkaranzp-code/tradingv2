"use strict";

const RETRACEMENT_RULES = Array.from({ length: 7 }, (_, i) => ({
  id: "NW-RET-" + String(i + 1).padStart(2, "0"),
  family: "retracement",
  status: "blocked_missing_authoritative_definition"
}));

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
    if (isHigh) {
      events.push({
        index: p, confirmedAt: p + right, time: bars[p].time,
        price: bars[p].high, type: "H"
      });
    }
    if (isLow) {
      events.push({
        index: p, confirmedAt: p + right, time: bars[p].time,
        price: bars[p].low, type: "L"
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
      direction: priceChange > 0 ? "up" : "down",
      priceChange,
      absoluteChange: Math.abs(priceChange),
      duration,
      barsPerPriceUnit: duration / Math.abs(priceChange),
      availableAt: Math.max(from.confirmedAt, to.confirmedAt)
    });
  }
  return waves;
}

function summarizeStructure(waves) {
  const ratios = waves.map((wave) => wave.barsPerPriceUnit).filter(Number.isFinite);
  const sorted = ratios.slice().sort((a, b) => a - b);
  return {
    waveCount: waves.length,
    classification: waves.length ? "unclassified_polywave" : "insufficient_data",
    alternating: waves.every((wave, i) => i === 0 || wave.direction !== waves[i - 1].direction),
    priceTimeRatios: ratios,
    medianBarsPerPriceUnit: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  };
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
    pivots,
    waves,
    structure,
    neoWaveGate,
    disclaimer: "Pivot/monowave diagnostics are not a complete NeoWave count. No candidate is tradable until every catalog rule is source-verified, applicable rules pass, and independent tests are complete."
  };
}

module.exports = {
  RULE_CATALOG,
  confirmedPivots,
  monowaves,
  summarizeStructure,
  validateNeoWaveCandidate,
  analyze
};
