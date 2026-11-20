"use strict";

// Elliott Wave classic: conservative rule-checking scaffold, not a complete wave-counting system.
// It validates an explicitly supplied 5-wave impulse or 3-wave zigzag sequence.
// It does not choose the "correct" count among competing market interpretations.

function validatePoints(points, expected) {
  if (!Array.isArray(points) || points.length !== expected) {
    return { ok: false, reason: "expected_" + expected + "_pivots" };
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p || !Number.isFinite(p.price) || !Number.isFinite(p.index) ||
        (p.type !== "H" && p.type !== "L") ||
        (i && (p.index <= points[i - 1].index || p.type === points[i - 1].type))) {
      return { ok: false, reason: "invalid_or_non_alternating_pivots" };
    }
  }
  return { ok: true };
}

function validateImpulse(points, options = {}) {
  const shape = validatePoints(points, 6);
  if (!shape.ok) return { pattern: "impulse", status: "rejected", reason: shape.reason };
  const bullish = points[0].type === "L" && points[5].type === "H";
  const bearish = points[0].type === "H" && points[5].type === "L";
  if (!bullish && !bearish) {
    return { pattern: "impulse", status: "rejected", reason: "direction_does_not_alternate" };
  }
  const d = bullish ? 1 : -1;
  const p = points.map(x => d * x.price);
  const w = Array.from({ length: 5 }, (_, i) => p[i + 1] - p[i]);
  if (w.some(x => x === 0 || !Number.isFinite(x))) {
    return { pattern: "impulse", status: "rejected", reason: "zero_or_invalid_wave" };
  }
  if (!(w[0] > 0 && w[1] < 0 && w[2] > 0 && w[3] < 0 && w[4] > 0)) {
    return { pattern: "impulse", status: "rejected", reason: "motive_corrective_sequence_invalid" };
  }
  if (p[2] <= p[0]) {
    return { pattern: "impulse", status: "rejected", reason: "wave2_exceeds_origin_of_wave1" };
  }
  if (p[3] <= p[1]) {
    return { pattern: "impulse", status: "rejected", reason: "wave3_does_not_exceed_wave1_end" };
  }
  const diagonal = options.allowDiagonal === true;
  if (!diagonal && p[4] <= p[1]) {
    return { pattern: "impulse", status: "rejected", reason: "wave4_overlaps_wave1_territory" };
  }
  if (w[2] < Math.min(w[0], w[4])) {
    return { pattern: "impulse", status: "rejected", reason: "wave3_is_shortest" };
  }
  if (p[5] <= p[3]) {
    return { pattern: "impulse", status: "rejected", reason: "wave5_does_not_exceed_wave3_end" };
  }
  return {
    pattern: diagonal ? "impulse_candidate_diagonal_rules_not_fully_checked" : "impulse",
    status: "valid_under_checked_rules",
    direction: bullish ? "bullish" : "bearish",
    waveLengths: w.map(Math.abs),
    availableAt: points[5].confirmedAt ?? points[5].index,
    limitations: ["subdivision_not_checked", "degree_not_checked", "channeling_not_checked",
      "alternation_guideline_not_checked", "diagonal_impulse_rules_not_implemented"]
  };
}

function validateZigzag(points) {
  const shape = validatePoints(points, 4);
  if (!shape.ok) return { pattern: "zigzag", status: "rejected", reason: shape.reason };
  const bullish = points[0].type === "L" && points[3].type === "H";
  const bearish = points[0].type === "H" && points[3].type === "L";
  if (!bullish && !bearish) return { pattern: "zigzag", status: "rejected", reason: "direction_invalid" };
  const d = bullish ? 1 : -1;
  const p = points.map(x => d * x.price);
  if (!(p[1] > p[0] && p[2] < p[1] && p[2] > p[0] && p[3] > p[1])) {
    return { pattern: "zigzag", status: "rejected", reason: "abc_price_relationship_invalid" };
  }
  return {
    pattern: "zigzag",
    status: "candidate_under_basic_price_rules",
    direction: bullish ? "bullish_correction" : "bearish_correction",
    availableAt: points[3].confirmedAt ?? points[3].index,
    limitations: ["internal_subdivision_not_checked", "A_C_relationship_not_checked",
      "degree_not_checked", "alternation_and_context_not_checked"]
  };
}

function confirmedPivots(bars, left = 3, right = 3) {
  if (!Array.isArray(bars) || !Number.isInteger(left) || !Number.isInteger(right) || left < 1 || right < 1) {
    throw new Error("invalid_pivot_arguments");
  }
  const out = [];
  for (let i = left; i < bars.length - right; i++) {
    const b = bars[i];
    let high = true, low = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (bars[j].high >= b.high) high = false;
      if (bars[j].low <= b.low) low = false;
    }
    if (high) out.push({ index: i, confirmedAt: i + right, time: b.time, price: b.high, type: "H" });
    if (low) out.push({ index: i, confirmedAt: i + right, time: b.time, price: b.low, type: "L" });
  }
  out.sort((a,b) => a.index - b.index || (a.type === "L" ? -1 : 1));
  const alternating = [];
  for (const p of out) {
    const prev = alternating.at(-1);
    if (!prev) alternating.push(p);
    else if (prev.type === p.type) {
      if ((p.type === "H" && p.price > prev.price) || (p.type === "L" && p.price < prev.price)) alternating[alternating.length - 1] = p;
    } else alternating.push(p);
  }
  return alternating;
}

function scanBars(bars, options = {}) {
  const pivots = confirmedPivots(bars, options.left ?? 3, options.right ?? 3);
  const impulses = [], zigzags = [];
  for (let end = 5; end < pivots.length; end++) {
    const result = validateImpulse(pivots.slice(end - 5, end + 1));
    if (result.status === "valid_under_checked_rules") impulses.push({ startPivot: end - 5, endPivot: end, ...result });
  }
  for (let end = 3; end < pivots.length; end++) {
    const result = validateZigzag(pivots.slice(end - 3, end + 1));
    if (result.status === "candidate_under_basic_price_rules") zigzags.push({ startPivot: end - 3, endPivot: end, ...result });
  }
  return {
    bars: bars.length, pivots: pivots.length, impulseCandidates: impulses.length,
    zigzagCandidates: zigzags.length, impulses, zigzags,
    disclaimer: "Research diagnostics only. Not a complete Elliott count or a trading signal."
  };
}

module.exports = { validateImpulse, validateZigzag, confirmedPivots, scanBars };
