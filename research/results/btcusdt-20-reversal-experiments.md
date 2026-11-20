# BTCUSDT — 20 reversal-cycle experiments

Binance Spot, 4h candles, 2017-08-17 to 2026-11-20.
All signals are closed-candle only; next-open fills; long-only spot; fee 0.10% + slippage 0.05% per side.

Buy-and-hold benchmark: full 1346.04%; development 889.26%; OOS 45.74%.

## OUT OF SAMPLE — 2024-01-01 onward

| Test | Trades | Wins | Win rate | 95% Wilson CI | Net return | PF | Max DD | Exposure | Expectancy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| R20 RSI 20 oversold recovery | 14 | 5 | 35.7% | 16.3–61.2% | -7.94% | 0.819458437491174 | 26.69% | 9.2% | -0.405% |
| R25 RSI 25 oversold recovery | 33 | 15 | 45.5% | 29.8–62.0% | -3.22% | 0.9622323952184995 | 29.19% | 20.4% | 0.059% |
| R30 RSI 30 oversold recovery | 60 | 26 | 43.3% | 31.6–55.9% | -6.00% | 0.9634394234969855 | 32.25% | 30.5% | 0.060% |
| R35 RSI 35 oversold recovery | 92 | 35 | 38.0% | 28.8–48.3% | -49.17% | 0.7469116097224804 | 56.21% | 42.6% | -0.598% |
| R40 RSI 40 oversold recovery | 115 | 44 | 38.3% | 29.9–47.4% | -44.93% | 0.7987095191693057 | 48.05% | 48.8% | -0.404% |
| S5 Stochastic K/D cross from below 5 | 67 | 26 | 38.8% | 28.0–50.8% | -24.35% | 0.844785131402672 | 38.21% | 26.3% | -0.278% |
| S10 Stochastic K/D cross from below 10 | 113 | 50 | 44.2% | 35.4–53.4% | -29.71% | 0.8753621652108763 | 42.61% | 48.3% | -0.192% |
| S15 Stochastic K/D cross from below 15 | 135 | 51 | 37.8% | 30.0–46.2% | -63.97% | 0.7374492317219282 | 70.23% | 56.1% | -0.633% |
| S20 Stochastic K/D cross from below 20 | 151 | 57 | 37.7% | 30.4–45.7% | -64.82% | 0.7494770907537129 | 69.85% | 60.6% | -0.572% |
| S25 Stochastic K/D cross from below 25 | 166 | 66 | 39.8% | 32.6–47.4% | -64.92% | 0.7697767615035981 | 68.62% | 65.2% | -0.510% |
| W95 Williams %R recovery from -95 | 81 | 30 | 37.0% | 27.3–47.9% | -34.15% | 0.7986393528099023 | 47.46% | 33.1% | -0.381% |
| W90 Williams %R recovery from -90 | 121 | 55 | 45.5% | 36.9–54.3% | -38.16% | 0.8338140209442441 | 51.91% | 52.9% | -0.282% |
| W85 Williams %R recovery from -85 | 143 | 59 | 41.3% | 33.5–49.5% | -48.76% | 0.8293609316578776 | 59.83% | 61.0% | -0.342% |
| W80 Williams %R recovery from -80 | 154 | 60 | 39.0% | 31.6–46.8% | -60.45% | 0.7832492428439013 | 65.29% | 63.5% | -0.483% |
| W75 Williams %R recovery from -75 | 169 | 66 | 39.1% | 32.0–46.6% | -60.08% | 0.7949984769993883 | 64.27% | 63.5% | -0.422% |
| D16 Regular bullish RSI divergence (2L/2R, RSI pivot <=35) | 23 | 10 | 43.5% | 25.6–63.2% | 4.46% | 1.0716764716369662 | 20.78% | 11.4% | 0.375% |
| D17 Regular bullish RSI divergence (3L/3R, RSI pivot <=40) | 37 | 18 | 48.6% | 33.4–64.1% | -1.45% | 0.9840708409357348 | 21.13% | 17.8% | 0.110% |
| D18 Regular bullish RSI divergence (5L/3R, RSI pivot <=45) | 47 | 22 | 46.8% | 33.3–60.8% | -18.10% | 0.8385221158546807 | 30.26% | 22.9% | -0.293% |
| D19 Regular bullish MACD-histogram divergence (3L/3R) | 65 | 28 | 43.1% | 31.8–55.2% | -30.68% | 0.7538691359274621 | 32.18% | 23.7% | -0.461% |
| D20 RSI divergence + Stochastic confirmation + volume capitulation | 2 | 2 | 100.0% | 34.2–100.0% | 12.78% | inf | 6.32% | 1.7% | 6.200% |

## DEVELOPMENT — before 2024

| Test | Trades | Wins | Win rate | 95% Wilson CI | Net return | PF | Max DD | Exposure | Expectancy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| R20 RSI 20 oversold recovery | 31 | 15 | 48.4% | 32.0–65.2% | -17.92% | 0.8300762086826337 | 46.87% | 9.2% | -0.185% |
| R25 RSI 25 oversold recovery | 73 | 31 | 42.5% | 31.8–53.9% | -50.23% | 0.7665501869192699 | 74.10% | 19.8% | -0.457% |
| R30 RSI 30 oversold recovery | 127 | 64 | 50.4% | 41.8–58.9% | -18.58% | 0.9405560501674316 | 78.71% | 34.1% | 0.320% |
| R35 RSI 35 oversold recovery | 164 | 80 | 48.8% | 41.2–56.4% | -44.97% | 0.8561996914883162 | 86.53% | 41.0% | 0.063% |
| R40 RSI 40 oversold recovery | 204 | 102 | 50.0% | 43.2–56.8% | -0.13% | 0.9997246070421036 | 66.70% | 46.8% | 0.340% |
| S5 Stochastic K/D cross from below 5 | 91 | 42 | 46.2% | 36.3–56.3% | -11.29% | 0.9668604987365798 | 58.32% | 21.6% | 0.328% |
| S10 Stochastic K/D cross from below 10 | 194 | 93 | 47.9% | 41.0–54.9% | -44.92% | 0.9058421111131081 | 78.88% | 41.7% | 0.058% |
| S15 Stochastic K/D cross from below 15 | 249 | 119 | 47.8% | 41.7–54.0% | -48.05% | 0.8975640773989938 | 78.35% | 51.8% | 0.064% |
| S20 Stochastic K/D cross from below 20 | 284 | 137 | 48.2% | 42.5–54.0% | -70.45% | 0.8159052476212283 | 86.50% | 59.3% | -0.105% |
| S25 Stochastic K/D cross from below 25 | 309 | 150 | 48.5% | 43.0–54.1% | -70.91% | 0.8309978970574726 | 87.28% | 63.9% | -0.075% |
| W95 Williams %R recovery from -95 | 119 | 56 | 47.1% | 38.3–56.0% | 33.61% | 1.0599205937831302 | 69.54% | 28.9% | 0.722% |
| W90 Williams %R recovery from -90 | 222 | 108 | 48.6% | 42.2–55.2% | -28.57% | 0.9530195335194276 | 81.62% | 46.0% | 0.222% |
| W85 Williams %R recovery from -85 | 260 | 130 | 50.0% | 44.0–56.0% | -10.38% | 0.9876168510823786 | 80.33% | 56.1% | 0.307% |
| W80 Williams %R recovery from -80 | 287 | 146 | 50.9% | 45.1–56.6% | -16.95% | 0.9775588071565325 | 83.63% | 60.4% | 0.277% |
| W75 Williams %R recovery from -75 | 305 | 148 | 48.5% | 43.0–54.1% | -69.68% | 0.8427267444340397 | 89.78% | 61.7% | -0.062% |
| D16 Regular bullish RSI divergence (2L/2R, RSI pivot <=35) | 39 | 19 | 48.7% | 33.9–63.8% | 2.07% | 1.0133028902241141 | 37.87% | 11.0% | 0.488% |
| D17 Regular bullish RSI divergence (3L/3R, RSI pivot <=40) | 54 | 24 | 44.4% | 32.0–57.6% | -59.14% | 0.5687829820740496 | 66.84% | 12.3% | -1.254% |
| D18 Regular bullish RSI divergence (5L/3R, RSI pivot <=45) | 81 | 40 | 49.4% | 38.8–60.0% | -18.72% | 0.9250607276342596 | 58.36% | 18.9% | 0.101% |
| D19 Regular bullish MACD-histogram divergence (3L/3R) | 135 | 61 | 45.2% | 37.0–53.6% | -57.43% | 0.7690607597777103 | 65.79% | 26.0% | -0.376% |
| D20 RSI divergence + Stochastic confirmation + volume capitulation | 4 | 3 | 75.0% | 30.1–95.4% | 4.19% | 1.4553940073150267 | 15.59% | 0.8% | 1.231% |

## FULL HISTORY

| Test | Trades | Wins | Win rate | 95% Wilson CI | Net return | PF | Max DD | Exposure | Expectancy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| R20 RSI 20 oversold recovery | 45 | 20 | 44.4% | 30.9–58.8% | -24.43% | 0.8273674906379316 | 46.87% | 9.2% | -0.254% |
| R25 RSI 25 oversold recovery | 106 | 46 | 43.4% | 34.4–52.9% | -51.84% | 0.7988138277315354 | 74.10% | 20.0% | -0.296% |
| R30 RSI 30 oversold recovery | 187 | 90 | 48.1% | 41.1–55.3% | -23.46% | 0.9474135529210994 | 78.71% | 33.0% | 0.236% |
| R35 RSI 35 oversold recovery | 256 | 116 | 45.3% | 39.3–51.4% | -70.78% | 0.8330666375807178 | 86.53% | 41.5% | -0.157% |
| R40 RSI 40 oversold recovery | 319 | 147 | 46.1% | 40.7–51.6% | -42.53% | 0.9404880789938115 | 66.70% | 47.5% | 0.086% |
| S5 Stochastic K/D cross from below 5 | 158 | 68 | 43.0% | 35.6–50.8% | -32.89% | 0.9314598484968084 | 58.32% | 23.1% | 0.071% |
| S10 Stochastic K/D cross from below 10 | 307 | 143 | 46.6% | 41.1–52.2% | -61.29% | 0.8992644724305813 | 78.88% | 43.7% | -0.034% |
| S15 Stochastic K/D cross from below 15 | 384 | 171 | 44.5% | 39.6–49.5% | -80.44% | 0.8660290336632632 | 81.78% | 53.2% | -0.169% |
| S20 Stochastic K/D cross from below 20 | 435 | 195 | 44.8% | 40.2–49.5% | -89.14% | 0.8070906044433769 | 90.09% | 59.7% | -0.257% |
| S25 Stochastic K/D cross from below 25 | 475 | 217 | 45.7% | 41.3–50.2% | -89.34% | 0.8231106168904904 | 90.28% | 64.4% | -0.218% |
| W95 Williams %R recovery from -95 | 200 | 86 | 43.0% | 36.3–49.9% | -12.02% | 0.9847405327292253 | 69.54% | 30.2% | 0.275% |
| W90 Williams %R recovery from -90 | 343 | 163 | 47.5% | 42.3–52.8% | -55.83% | 0.9276965686884731 | 81.62% | 48.2% | 0.044% |
| W85 Williams %R recovery from -85 | 403 | 189 | 46.9% | 42.1–51.8% | -52.02% | 0.952953409354056 | 80.33% | 57.7% | 0.088% |
| W80 Williams %R recovery from -80 | 441 | 207 | 46.9% | 42.3–51.6% | -65.68% | 0.9340777477958706 | 83.63% | 61.4% | 0.022% |
| W75 Williams %R recovery from -75 | 474 | 215 | 45.4% | 40.9–49.9% | -87.36% | 0.8369178386416903 | 91.04% | 62.3% | -0.181% |
| D16 Regular bullish RSI divergence (2L/2R, RSI pivot <=35) | 62 | 29 | 46.8% | 34.9–59.0% | 6.62% | 1.0302184452433643 | 37.87% | 11.1% | 0.446% |
| D17 Regular bullish RSI divergence (3L/3R, RSI pivot <=40) | 91 | 42 | 46.2% | 36.3–56.3% | -59.73% | 0.6573157933157258 | 66.84% | 14.0% | -0.700% |
| D18 Regular bullish RSI divergence (5L/3R, RSI pivot <=45) | 128 | 62 | 48.4% | 40.0–57.0% | -33.43% | 0.9019321835526624 | 58.36% | 20.2% | -0.044% |
| D19 Regular bullish MACD-histogram divergence (3L/3R) | 200 | 89 | 44.5% | 37.8–51.4% | -70.49% | 0.7663893227589125 | 70.94% | 25.3% | -0.404% |
| D20 RSI divergence + Stochastic confirmation + volume capitulation | 6 | 5 | 83.3% | 43.6–97.0% | 17.51% | 2.90151302586791 | 15.59% | 1.1% | 2.888% |

## Method and safeguards

- Entry families: RSI oversold recovery, Stochastic recovery, Williams %R recovery, and confirmed regular bullish divergence.
- All tests use the same predeclared cycle exit: RSI overbought, confirmed bearish RSI divergence, 3 ATR protective stop, or 90 bars.
- Divergence is not backdated to the pivot candle. It becomes actionable only after right-side candles confirm the pivot.
- Fees and slippage are charged on both entry and exit. Stop gaps fill at the opening price when worse than the stop.
- Win-rate confidence intervals use Wilson 95%; a high percentage with a small sample is not reliable.
- A candidate is not considered successful from win rate alone: net return, PF, drawdown, sample size, expectancy and buy-and-hold comparison all matter.
- Historical backtests are not a live-trading recommendation.

## Experiment definitions

| ID | Entry condition |
|---|---|
| R20 | RSI 20 oversold recovery |
| R25 | RSI 25 oversold recovery |
| R30 | RSI 30 oversold recovery |
| R35 | RSI 35 oversold recovery |
| R40 | RSI 40 oversold recovery |
| S5 | Stochastic K/D cross from below 5 |
| S10 | Stochastic K/D cross from below 10 |
| S15 | Stochastic K/D cross from below 15 |
| S20 | Stochastic K/D cross from below 20 |
| S25 | Stochastic K/D cross from below 25 |
| W95 | Williams %R recovery from -95 |
| W90 | Williams %R recovery from -90 |
| W85 | Williams %R recovery from -85 |
| W80 | Williams %R recovery from -80 |
| W75 | Williams %R recovery from -75 |
| D16 | Regular bullish RSI divergence (2L/2R, RSI pivot <=35) |
| D17 | Regular bullish RSI divergence (3L/3R, RSI pivot <=40) |
| D18 | Regular bullish RSI divergence (5L/3R, RSI pivot <=45) |
| D19 | Regular bullish MACD-histogram divergence (3L/3R) |
| D20 | RSI divergence + Stochastic confirmation + volume capitulation |
