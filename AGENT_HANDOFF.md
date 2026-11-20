# Trading V2 — Agent Handoff Instructions

This file is a durable handoff for the next coding session. It does **not** run an AI agent or keep a ChatGPT session alive. A human or coding agent must open the repository and follow these instructions.

## Product objective

Finish Trading V2 as a customer-ready, independent market-analysis terminal. Do not turn it into a TradingView wrapper or depend on TradingView. The user wants the finished product, not preview mockups or progress-only reports.

## Working rules

1. Work on the existing Trading V2 repository and preserve useful existing functionality.
2. Before editing, inspect the current default branch, recent commits, deployment configuration, and the complete application source. Do not assume older handoff notes are still accurate.
3. Make real, tested improvements. Never report a feature as complete merely because its UI exists.
4. Never fabricate prices, candles, volume, order-book levels, trades, backtest results, or strategy signals. Show clear unavailable/stale/error states when data is missing.
5. Keep exchange credentials out of browser code and repository history. Public market-data endpoints may be used without credentials. Paper trading must remain clearly marked as simulation unless explicitly redesigned.
6. Preserve independent strategy engines and their data requirements. Do not silently substitute spot data for perpetual/futures data or incomplete history for validated history.
7. Avoid destructive changes, force pushes, secret exposure, and unreviewed deployment changes.
8. Run available automated checks after each meaningful change. Add tests for critical calculations and edge cases where practical.
9. Verify responsive layout, empty/loading/error states, reconnect behavior, and data timestamps.
10. Report only verified results, with commit links and exact outstanding blockers.

## Current known application context (verify before relying on it)

- Main UI source was last observed at `web/index.html`.
- The observed implementation used Binance public REST market-data endpoints and a Binance WebSocket stream.
- The observed UI included candlesticks/line mode, EMA 20/50, Donchian, chart navigation, a watchlist, order book, recent trades, footprint, an approximate OHLCV-based profile, local paper trading, chart drawings, and a local research journal.
- Some panels explicitly disclosed limitations (for example, footprint based on only the latest aggregate trades and approximate profile distribution). Keep such limitations visible unless replaced by more accurate calculations.
- Previous GitHub Pages deployment attempts encountered an environment protection rule rejecting deployment from branch `work/rust-risk-core`. Re-check current deployment settings and branch protections; do not assume that error is still current.

## Priority acceptance checklist

### P0 — App boots and data is trustworthy
- Confirm GitHub Pages build/deployment configuration and the actual published URL.
- Confirm the published artifact corresponds to the intended commit.
- Validate REST responses, WebSocket updates, reconnect/backoff, rate-limit handling, stale-data detection, and symbol/timeframe switching.
- Ensure candle timestamps, OHLC values, ordering, duplicate handling, and current-vs-closed candle status are correct.
- Ensure the chart renders on desktop and mobile and never silently shows fabricated/demo data.

### P1 — Trading terminal behavior
- Test chart zoom, pan, crosshair/OHLC, indicators, drawings, and timeframe changes.
- Validate order-book and trade-tape rendering and refresh behavior.
- Clearly distinguish measured exchange data from estimates/approximations in footprint and profile panels.
- Test paper-trading accounting: average entry, partial reductions, realized/unrealized P&L, insufficient cash, invalid quantities, reset, and persistence.
- Test journal persistence and safe rendering of user-entered text.
- Make alert behavior robust and non-spammy.

### P2 — Research and strategy integrity
- Inspect Quattro Donchian v2 and TSMOM engines and their inputs independently.
- Validate data sufficiency, closed-bar-only calculations where required, fees/slippage assumptions, look-ahead bias, and walk-forward separation.
- Do not invent a NeoWave signal. Keep it clearly marked as unavailable until a real, testable engine exists.
- Add reproducible tests for indicators, risk calculations, and strategy outputs.

### Final release gate
Do not call the project customer-ready until the build succeeds, critical tests pass, live data behavior is verified, no critical console/runtime errors remain, and the published deployment is checked. List any remaining limitations plainly.


## NeoWave research status (2026-11-20)

- The user-provided ZIP has been extracted outside the repository. It contains the English *Mastering Elliott Wave* scan (169 pages) and Persian scan (446 pages). Do not upload either PDF or full OCR output to GitHub; the front matter asserts copyright/translation rights.
- Source tracking is corrected in `docs/NEOWAVE_SOURCE.md`. First-pass contents map: `research/NEOWAVE_SOURCE_EXTRACTION_V1.md`. Partial seven-rule activation map and unresolved issues: `research/NEOWAVE_RETRACEMENT_RULES_EXTRACTION_V1.md`.
- English OCR has reviewed the front matter, contents, opening Chapter 1, parts of Chapter 2, the Chapter 3 setup and Retracement Rule activation pages, plus only the opening pages of the Pre-Constructive section (partial Rule 1–3 material). The Persian OCR is not yet reliable. Neither edition has been fully reviewed.
- The seven Retracement Rule activation bands are now known from printed Chapter 3 pp. 3-23–3-30, but these are not executable definitions. Rule selection uses m2/m1; lettered conditions use m0/m1; Rule 4 adds a category using m3/m2. The next 26-page Pre-Constructive Rules of Logic section transforms rule/condition identifiers into Structure Labels and contains numerous contextual conditions involving later waves, time, price, trendlines, complex corrections, and X-waves.
- Important unresolved source issue: the book describes Rule 3 as an exact 61.8% retracement but then gives approximate tolerances for Fibonacci ratios (61.8% ≈ 58–66%). Boundary and tolerance semantics must be reconciled before implementation.
- `engine/neowave_engine.cjs` now requires source-verified rule definitions, source locators, and explicit pattern applicability. Unknown applicability and non-pass results fail closed. Catalog entries are required for engine certification, not automatically mandatory for every candidate.
- Tests pass in GitHub Actions, including the expanded NeoWave suite: latest verified NeoWave run `44768775867` succeeded for commit `f10ab32abb80aa3897ef6bc25c620152e88ef9a1`.
- Do not mark NeoWave complete or tradable. No actual retracement predicates, Pre-Constructive Structure Label decision trees, complete pattern families, post-pattern confirmation, invalidation/recount, or NeoWave-qualified backtest have been completed.
- Next work: continue page-by-page source extraction of the 26-page Pre-Constructive section and all applicable pattern chapters; build a source-located rule register with positive/negative/boundary/missing-data fixtures; implement only after exact definitions and applicability are verified; preserve causal availability timestamps for all referenced waves; then run synthetic tests before any historical BTCUSDT experiment.


### NeoWave follow-up review and final check (2026-11-20)
- Rechecked the current engine, tests, source notes, and design file on `main`.
- Visually inspected English scan PDF pp. 39–47, corresponding to the start of the 26-page Pre-Constructive Rules of Logic section and the first Rule 1/2/3/4 branches. Additional contact-sheet review covered the remainder of that section through PDF p. 64, where Chapter 5 begins. OCR was partial/noisy; this is not a page-by-page verified transcription.
- Confirmed that the Pre-Constructive section produces competing Structure Label hypotheses, ranks alternatives with parentheses/brackets, and revises the list as later waves and price/time evidence arrive. Conditions reference preceding/following waves, retracements, shared price territory, trendline breaks, time comparisons, and missing X-wave hypotheses. It is not safe to replace this with a simple Fibonacci threshold classifier.
- Corrected a real production-gate weakness: previously, arbitrary caller-supplied functions plus `sourceVerified: true` could make the validator return `tradable: true`. Added a closed `ENGINE_CERTIFICATION` manifest. Production validation now stays blocked regardless of caller-supplied fake provenance until source review and independent rule tests are complete.
- Added a regression test for that certification barrier. A first CI run failed because an old test still expected candidate rejection from the now-closed path; the test was corrected to assert the production block.
- Latest GitHub Actions verification: run `44779870190`, commit `b2a0878764ad0d1db3dffce75f4dbfa84baa2f2a`, conclusion **success**. Workflow runs `node --test engine/neowave_engine.test.cjs`; all nine tests passed.
- Important: these are scaffold/causality/validation-gate tests, not full NeoWave conformance tests. No NeoWave-qualified historical backtest has been run. Do not describe the engine as complete, certified, or tradable.
- Remaining work is substantial: finish exact extraction of all Pre-Constructive decision branches; verify all seven rule pages/diagrams and all exceptions; extract Chapter 4 similarity/balance/DETOUR, Chapter 5 polywave construction/impulse/corrections/overlap/alternation/equality/channeling, Chapters 6–12 complex patterns/X-waves/Diametric/Symmetrical and post-completion behavior; then implement source-located predicates and positive/negative/boundary/missing-data tests before any NeoWave backtest.
