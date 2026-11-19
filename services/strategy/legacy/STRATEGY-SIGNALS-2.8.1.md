# Strategy Signals — v2.8.1 (ported specification)

Source: `ebehinkaranzp-code/trading-dashboard`, commit containing `modules/strategy-engine.js` blob `d1b65bb5ab90f47f77fbc38f9d36b660d1c31c5c`.

This document records the legacy engine's rules. It does not certify profitability and does not enable order execution.

## Quattro Donchian v2

- Instrument: BTC perpetual, 4-hour candles.
- Entry signal: a closed 4-hour candle closes above the highest high of the prior 20 candles.
- Regime filter: 4-hour close above the EMA200 of the most recently completed daily candle. The executable source applies this rule; an earlier research README described a different "rising EMA" condition.
- Fill model: next candle open.
- Volatility: ATR(14), Wilder smoothing; N is frozen at initial entry.
- Scale-ins: up to four units, at 0.5N, 1.0N and 1.5N above initial entry.
- Unit risk sizing: 2% of current simulated balance divided by 2N; leverage cap 20x.
- Shared stop: latest unit entry minus 2N; emergency floating-loss stop 5% of balance at initial entry.
- Exit signal: close below the lowest low of the prior 10 candles, filled at next open.
- Taker fee: 0.06% per side. Funding and live slippage are not modeled by the signal engine.

## Momentum + Volatility Targeting

- Instruments: BTC and ETH; daily candles; long-only; no leverage.
- Candidate momentum lookbacks: 7, 14, 21, 30, 45, 60, 90, 120, 180, 270 and 365 days.
- Select lookback by highest net Sharpe over a rolling 1,095-day training window, after 365-day warm-up; test folds are 182 days.
- Realized volatility: 30-day sample standard deviation annualized by sqrt(365).
- Volatility target: 40%; exposure capped at 100%.
- No-trade band: 10%; transitions to/from zero are always applied.
- One-day execution delay. Parameter-selection cost assumption: 10 bps fee + 5 bps slippage per unit turnover.
- No fixed stop-loss or take-profit is defined in the source.

## Alert and data rules

- Events include Quattro entry-pending, entry, add and exit; Momentum entry, exit and meaningful rebalance.
- Duplicate keys are based on strategy, instrument, event type and candle time.
- First calculation initializes state without replaying historical alerts.
- Stale data must not produce alerts. Browser notifications require HTTPS and permission; reliable background delivery needs a backend push service.
- The engine calculates signals only. It contains no exchange client and sends no orders.

## Known limitations to resolve before production use

1. Quattro uses a hard-coded initial balance of 1,839.17 in the legacy simulation; this must become explicit configuration before performance comparisons.
2. Funding and realistic slippage are absent from Quattro's signal-state simulation.
3. The source engine accepts arrays of candles but does not validate monotonic timestamps, duplicate bars, gaps, OHLC consistency or source freshness.
4. The Momentum implementation's output is a current signal estimate, not a complete walk-forward equity curve or a proof of out-of-sample profitability.
5. The strategy engine must be wrapped by a separate risk service and paper-execution adapter. It must never submit live orders.

## Dataset licensing

The legacy BTC/ETH CSV files identify Coin Metrics Community data and CC BY-NC 4.0 terms. Those CSV datasets are intentionally not copied into Trading V2 in this port. Obtain separately licensed data before any commercial use or redistribution.
