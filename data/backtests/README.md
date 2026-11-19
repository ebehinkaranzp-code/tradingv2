# TSMOM Walk-Forward Backtest — 2026-11-19

## Result

This is a historical out-of-sample walk-forward test of the repository's published Momentum + Volatility Targeting rules, using the close-only BTC and ETH daily CSV files in `ebehinkaranzp-code/trading-dashboard`.

| Metric | BTC | ETH |
|---|---:|---:|
| Data bars | 4,526 | 3,796 |
| Data coverage | 2014-01-01 to 2026-05-23 | 2016-01-01 to 2026-05-23 |
| OOS folds | 17 | 13 |
| OOS days | 3,066 | 2,336 |
| Total OOS return | 542.06% | 309.79% |
| CAGR | 24.78% | 24.66% |
| Maximum drawdown | -57.41% | -36.41% |
| Sharpe | 0.837 | 0.825 |
| Profitable exposure cycles | 44 / 124 | 36 / 96 |
| Exposure-cycle win rate | 35.48% | 37.50% |

## Method

- Match the production engine's history filters (BTC from 2014-01-01; ETH from 2016-01-01), then use its 365-day warm-up and 1,095-day rolling training window.
- Choose the best of 11 lookbacks (7 to 365 days) by net training Sharpe.
- Apply the selected lookback only to the next 182-day test fold.
- Long-only, 40% annualized volatility target, 100% maximum exposure.
- 10% no-trade band and one-day execution delay.
- Charge 10 bps fee + 5 bps slippage per unit of absolute exposure turnover.
- Signals use only information available at the time; no future candle is used.
- Cycle win rate means profitable uninterrupted periods with positive exposure, not a per-order win rate.

## Findings and limits

1. The tested implementation does **not** have a 100% win rate. Exposure-cycle win rate is 35.48% on BTC and 37.50% on ETH.
2. Drawdowns are large, especially BTC at 53.79%; high cumulative return must not hide this risk.
3. The source CSV archive ends on 2026-05-23 and is stale for a current signal.
4. These CSVs contain daily closes only. They cannot validate Quattro Donchian v2, which requires continuous BTC perpetual 4H OHLCV plus daily OHLCV.
5. Funding, liquidation, market impact and venue-specific execution are not modeled.
6. The source dataset is Coin Metrics Community data under CC BY-NC 4.0. Its license must be respected; do not redistribute it commercially.

The full machine-readable metrics and methodology are in `tsmom-walkforward-2026-11-19.json`.
