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
