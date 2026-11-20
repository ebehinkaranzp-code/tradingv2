# BTCUSDT Reversal System — Architecture and Validation Plan

## Objective
Long-only BTCUSDT Spot reversal research. No EMA200/trend-following entry logic. Quality and out-of-sample robustness take priority over a fixed trade quota. No live orders.

## Pipeline
1. Data integrity: archived Binance Spot OHLCV, incremental updates, gap/duplicate checks, immutable snapshots and hashes.
2. Causal multi-timeframe context: 1D cycle/major structure; 4H confirmation; 1H behavior shift; 15m execution. HTF bars become visible only after close.
3. NeoWave structural engine: confirmed pivots, monowaves/polywaves, degree hierarchy, price/time relationships, pattern candidates, mandatory applicable rules, invalidation and recount. A candidate is blocked if any applicable rule is failed or indeterminate, or if the source-verified rulebook is incomplete.
4. Price-action reversal engine: failed breakdown, reclaim of broken support, seller exhaustion/absorption proxies, displacement away from low, retest hold, explicit invalidation.
5. Confirmation layer: RSI/MACD divergence, volume, ATR and stochastic may confirm/rank a structurally valid setup; they cannot override a failed NeoWave rule.
6. Execution simulator: signal on closed 15m candle, fill no earlier than next open, realistic fees/slippage, no overlapping positions, conservative stop/target ordering, risk-based sizing.
7. Evaluation: chronological walk-forward splits, trade-level audit, benchmark, sensitivity, regime breakdown, bootstrap confidence intervals and untouched final holdout.

## Current implementation status
- Implemented in `engine/neowave_engine.cjs`: causal confirmed-pivot timestamps, alternating monowave extraction, price/time diagnostics, and fail-closed candidate validation.
- A first-pass activation map for all seven retracement rules has been recovered from printed Chapter 3 pages 3-23–3-30 (PDF pp. 34–38). It shows that the rule selection depends on m2/m1, then on lettered m0/m1 conditions, with an additional m3/m2 category for Rule 4. The following 26-page Pre-Constructive Rules of Logic section transforms these identifiers into Structure Labels; its complete logic is not yet extracted. These seven IDs therefore remain blocked placeholders, not executable predicates.
- Pattern-family entries are a coverage register, not evidence that the patterns are implemented.
- The gate now requires every catalog rule to have a source-verified definition, a document/locator, and an explicit pattern-applicability function. A rule may be not applicable to a specific candidate only when the applicability result includes a reason. Unknown applicability and any non-pass result for an applicable rule reject the candidate.
- Catalog entries are required for engine certification; they are not all presumed mandatory for every pattern. Pattern-specific applicability must come from the source.
- The expanded test suite passed in GitHub Actions: run `44767819291`, commit `33278682c497710656b9068014cbc9dff513fc9f`.
- This build is still a research scaffold, NOT a complete NeoWave implementation and not tradable.

## Source review
The user-provided English scan of *Mastering Elliott Wave*, Version 2.0 (1990), has 169 pages. Only the cover/front matter, contents, preface and selected opening Chapter 1 pages have been OCR-reviewed so far. The 446-page Persian scan is available but its text layer is not reliably extractable. The first-pass contents map and source locators are in `research/NEOWAVE_SOURCE_EXTRACTION_V1.md`. Neither edition has been fully reviewed; do not infer exact rule predicates from the contents headings.

## Rulebook completeness requirement
Each authoritative rule needs: stable ID, exact source/page, scope and degree, prerequisites, mathematical predicate, pass/fail/indeterminate semantics, invalidation behavior, and positive, negative, boundary, and missing-data synthetic tests. Pattern-specific criteria must be separately specified. Ambiguous rules fail closed.

An authorized NeoWave rulebook (for example, *Mastering Elliott Wave* and official supplements) is needed to encode the complete method. Public summaries are insufficient to claim complete coverage.

## Experiment protocol
- Baseline: previous 20 indicator-only MTF combinations; all 20 had negative 2024+ OOS net returns. Do not optimize those thresholds further.
- First executable experiment: price-action reversal candidates with indicators as secondary confirmations, while NeoWave gate remains diagnostic-only until the rulebook is complete.
- No candidate enters a NeoWave-qualified backtest until all applicable rules are implemented and independently tested.
- Report trades, win rate with interval, net return after costs, profit factor, max drawdown, expectancy, exposure, average win/loss, and yearly/regime stability.
- Roughly 20–30 valid trades/year is a preference, never a forced quota.
