# BTCUSDT first walk-forward experiment

**Status: research baseline only — not suitable for live or paper deployment yet.**

## Data
- Exchange/market: Binance BTCUSDT spot
- Interval: 1 day
- Downloaded: 3,246 candles
- Coverage: 2018-01-01 through 2026-11-20
- Out-of-sample prediction years: 2020–2026 (2,511 five-day direction labels)

## Model and leakage controls
- L2-regularized logistic regression using 15 price, volatility, momentum, trend and volume features.
- Target: whether the close five days later is above the current close.
- Expanding annual walk-forward: each year's model is trained only on observations whose full five-day outcome was already known before that calendar year began.
- Features at time t use candles only through t.
- Signal after daily close; simulated spot entry/exit at the next daily open.
- No parameter tuning on the test years.

## Results
| Metric | Result |
|---|---:|
| Out-of-sample directional accuracy | 50.18% |
| Brier score | 0.2523 (naive base-rate: 0.2492) |
| Confusion counts: true up / false up / true down / missed up | 1,038 / 961 / 222 / 290 |
| Simulated strategy return | +22.22% |
| Buy-and-hold return, same test span | +801.05% |
| Maximum drawdown | 66.92% |
| Closed trades | 282 |
| Win rate | 53.90% |
| Profit factor | 1.037 |
| Starting / ending equity | 10,000 / 12,222.48 |

## Annual out-of-sample accuracy
| Year | Training samples | Test samples | Accuracy |
|---:|---:|---:|---:|
| 2020 | 525 | 366 | 51.64% |
| 2021 | 891 | 365 | 54.25% |
| 2022 | 1,256 | 365 | 45.48% |
| 2023 | 1,621 | 365 | 50.41% |
| 2024 | 1,986 | 366 | 54.10% |
| 2025 | 2,352 | 365 | 52.05% |
| 2026 | 2,717 | 319 | 42.32% |

## What the errors say
A trivial always-up classifier would reach 52.89% accuracy, higher than this model's 50.18%; its Brier score (0.2523) is also worse than the constant base-rate baseline (0.2492). The model generated 961 false bullish calls and missed 290 upward outcomes, while correctly identifying only 222 downward outcomes. Its probability score is not better than a simple 0.25 Brier reference. The model is biased toward bullish predictions and does not reliably distinguish market regimes.

**Conclusion:** this first model has not learned a useful, robust trading edge. Its +22.22% return is far below buy-and-hold on the same interval, and its 66.92% drawdown is unacceptable. Do not connect it to live orders. The next research iteration must focus on regime classification, calibrated probabilities, volatility-adjusted position sizing, drawdown controls, and separate untouched final holdout periods. Any improvement must beat buy-and-hold and simple baselines after realistic costs across multiple market regimes.
