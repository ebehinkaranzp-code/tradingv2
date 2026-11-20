# BTCUSDT Reversal System — Architecture and Validation Plan

## Objective
Long-only BTCUSDT Spot reversal research. No EMA200/trend-following entry logic. Quality and out-of-sample robustness take priority over a fixed trade quota. No live orders.

## Pipeline
1. Data integrity: archived Binance Spot OHLCV, incremental updates, gap/duplicate checks, immutable snapshots and hashes.
2. Causal multi-timeframe context: 1D cycle/major structure; 4H confirmation; 1H behavior shift; 15m execution. HTF bars become visible only after close.
3. NeoWave structural engine: confirmed pivots, monowaves/polywaves, degree hierarchy, price/time relationships, pattern candidates, mandatory rules, invalidation and recount. A candidate is blocked if any mandatory rule is missing or indeterminate.
4. Price-action reversal engine: failed breakdown, reclaim of broken support, seller exhaustion/absorption proxies, displacement away from low, retest hold, explicit invalidation.
5. Confirmation layer: RSI/MACD divergence, volume, ATR and stochastic may confirm/rank a structurally valid setup; they cannot override a failed NeoWave rule.
6. Execution simulator: signal on closed 15m candle, fill no earlier than next open, realistic fees/slippage, no overlapping positions, conservative stop/target ordering, risk-based sizing.
7. Evaluation: chronological walk-forward splits, trade-level audit, benchmark, sensitivity, regime breakdown, bootstrap confidence intervals and untouched final holdout.

## Current implementation status
- Implemented in engine/neowave_engine.cjs: causal confirmed-pivot timestamps, alternating monowave extraction, price/time diagnostics and fail-closed validation gate.
- Seven retracement rule slots are explicitly listed. Their exact predicates are intentionally unimplemented rather than invented.
- Pattern families and supporting NeoWave concepts are catalogued but not certified.
- This build is a research scaffold, NOT a complete NeoWave implementation and not tradable.

## Rulebook completeness requirement
Each authoritative rule needs: stable ID, exact source/page, scope and degree, prerequisites, mathematical predicate, pass/fail/indeterminate semantics, invalidation behavior, and positive plus negative synthetic tests. Pattern-specific criteria must be separately specified. Ambiguous rules fail closed.

An authorized NeoWave rulebook (for example, Mastering Elliott Wave and official supplements) is needed to encode the complete method. Public summaries are insufficient to claim complete coverage.

## Experiment protocol
- Baseline: previous 20 indicator-only MTF combinations; all 20 had negative 2024+ OOS net returns. Do not optimize those thresholds further.
- First executable experiment: price-action reversal candidates with indicators as secondary confirmations, while NeoWave gate remains diagnostic-only until the rulebook is complete.
- No candidate enters a NeoWave-qualified backtest until all applicable rules are implemented and independently tested.
- Report trades, win rate with interval, net return after costs, profit factor, max drawdown, expectancy, exposure, average win/loss, and yearly/regime stability.
- Roughly 20–30 valid trades/year is a preference, never a forced quota.
