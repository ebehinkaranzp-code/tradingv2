# BTCUSDT — 20 multi-timeframe experiments

Closed candles only; higher timeframe values become available only after their close; signal at 15m close, fill next 15m open; long-only spot; 3x 15m ATR stop; RSI>=70 or 96-bar time stop; one position; 0.1% fee and 0.05% slippage per side.

Higher timeframe alignment requires source open_time + interval duration <= execution candle close. Divergence is emitted only after two right-side candles confirm the pivot.

Buy & hold: development 889.26%; OOS 43.65%; full 1325.30%.

## development

| Test | Trades | Win rate | Wilson 95% | Net return | PF | Max DD | Exposure |
|---|---:|---:|---:|---:|---:|---:|---:|
| D40_H1R Daily RSI <=40 + 1H RSI recovery above 30 | 199 | 45.7% | 39.0–52.7% | 2.00% | 1.0068314733832773 | 45.81% | 3.8% |
| D40_H1DIV Daily RSI <=40 + Confirmed 1H bullish RSI divergence | 185 | 49.2% | 42.1–56.3% | 36.53% | 1.1237124750916012 | 27.23% | 3.7% |
| D40_M15K Daily RSI <=40 + 15m Stochastic recovery above 10 | 669 | 37.7% | 34.1–41.4% | -89.18% | 0.8031167551831971 | 92.49% | 11.5% |
| D40_M15R Daily RSI <=40 + 15m RSI recovery above 25 | 220 | 40.0% | 33.8–46.6% | -54.65% | 0.748014031871246 | 58.57% | 4.5% |
| D35_H1R Daily RSI <=35 + 1H RSI recovery above 30 | 109 | 45.9% | 36.8–55.2% | 19.79% | 1.120829172435871 | 37.80% | 2.2% |
| D35_H1DIV Daily RSI <=35 + Confirmed 1H bullish RSI divergence | 99 | 49.5% | 39.9–59.2% | 32.69% | 1.1960214504747557 | 18.94% | 2.0% |
| D35_M15K Daily RSI <=35 + 15m Stochastic recovery above 10 | 333 | 38.4% | 33.4–43.8% | -68.03% | 0.7958329087006506 | 79.17% | 5.5% |
| D35_M15R Daily RSI <=35 + 15m RSI recovery above 25 | 111 | 39.6% | 31.0–48.9% | -34.12% | 0.8115713115714746 | 45.67% | 2.2% |
| DREC_H1R Daily RSI <=50 and rising + 1H RSI recovery above 30 | 77 | 40.3% | 30.0–51.4% | -1.16% | 0.9860382469901718 | 21.32% | 1.6% |
| DREC_H1DIV Daily RSI <=50 and rising + Confirmed 1H bullish RSI divergence | 102 | 48.0% | 38.6–57.6% | -17.41% | 0.8339154097478385 | 30.92% | 2.1% |
| DREC_M15K Daily RSI <=50 and rising + 15m Stochastic recovery above 10 | 752 | 35.5% | 32.2–39.0% | -94.54% | 0.7475572561358019 | 96.13% | 12.3% |
| DREC_M15R Daily RSI <=50 and rising + 15m RSI recovery above 25 | 197 | 38.6% | 32.1–45.5% | -60.82% | 0.6099306771764795 | 67.33% | 4.0% |
| H4LOW_H1R 4H RSI <=35 + 1H RSI recovery above 30 | 348 | 41.7% | 36.6–46.9% | -67.82% | 0.7321465479399714 | 71.42% | 6.7% |
| H4LOW_H1DIV 4H RSI <=35 + Confirmed 1H bullish RSI divergence | 184 | 46.2% | 39.1–53.4% | 20.39% | 1.0720973143698793 | 33.33% | 4.0% |
| H4LOW_M15K 4H RSI <=35 + 15m Stochastic recovery above 10 | 438 | 39.0% | 34.6–43.7% | -80.88% | 0.743126169739385 | 81.94% | 8.8% |
| H4LOW_M15R 4H RSI <=35 + 15m RSI recovery above 25 | 262 | 42.4% | 36.5–48.4% | -60.73% | 0.7355833034886705 | 65.73% | 6.2% |
| D_H4_H1R Daily RSI <=45 and 4H RSI <=40 + 1H RSI recovery above 30 | 272 | 44.9% | 39.1–50.8% | -9.35% | 0.9725876560219519 | 50.01% | 4.9% |
| D_H4_H1DIV Daily RSI <=45 and 4H RSI <=40 + Confirmed 1H bullish RSI divergence | 177 | 48.0% | 40.8–55.3% | 47.23% | 1.1628588030466325 | 26.72% | 3.7% |
| D_H4_M15K Daily RSI <=45 and 4H RSI <=40 + 15m Stochastic recovery above 10 | 501 | 39.1% | 34.9–43.5% | -67.35% | 0.8466600397080012 | 79.39% | 9.0% |
| D_H4_M15R Daily RSI <=45 and 4H RSI <=40 + 15m RSI recovery above 25 | 255 | 41.2% | 35.3–47.3% | -57.58% | 0.7350061318604789 | 64.14% | 5.1% |

## outOfSample2024Plus

| Test | Trades | Win rate | Wilson 95% | Net return | PF | Max DD | Exposure |
|---|---:|---:|---:|---:|---:|---:|---:|
| D40_H1R Daily RSI <=40 + 1H RSI recovery above 30 | 89 | 43.8% | 34.0–54.2% | -12.57% | 0.8638320091867564 | 27.23% | 3.8% |
| D40_H1DIV Daily RSI <=40 + Confirmed 1H bullish RSI divergence | 74 | 39.2% | 28.9–50.6% | -26.14% | 0.5779159375877196 | 31.29% | 3.1% |
| D40_M15K Daily RSI <=40 + 15m Stochastic recovery above 10 | 295 | 39.0% | 33.6–44.7% | -45.19% | 0.8129973387073948 | 57.44% | 11.2% |
| D40_M15R Daily RSI <=40 + 15m RSI recovery above 25 | 100 | 38.0% | 29.1–47.8% | -20.62% | 0.8158597149858969 | 28.30% | 4.4% |
| D35_H1R Daily RSI <=35 + 1H RSI recovery above 30 | 45 | 40.0% | 27.0–54.5% | -11.38% | 0.7878098690458586 | 23.97% | 2.0% |
| D35_H1DIV Daily RSI <=35 + Confirmed 1H bullish RSI divergence | 40 | 35.0% | 22.1–50.5% | -24.58% | 0.4129202187255678 | 30.61% | 1.7% |
| D35_M15K Daily RSI <=35 + 15m Stochastic recovery above 10 | 156 | 39.7% | 32.4–47.6% | -30.98% | 0.8027362632041509 | 43.54% | 5.8% |
| D35_M15R Daily RSI <=35 + 15m RSI recovery above 25 | 58 | 34.5% | 23.6–47.3% | -17.79% | 0.7657069481988562 | 27.68% | 2.4% |
| DREC_H1R Daily RSI <=50 and rising + 1H RSI recovery above 30 | 45 | 40.0% | 27.0–54.5% | -13.32% | 0.6838589507675139 | 18.15% | 2.0% |
| DREC_H1DIV Daily RSI <=50 and rising + Confirmed 1H bullish RSI divergence | 51 | 39.2% | 27.0–52.9% | -15.87% | 0.5693001320444533 | 21.93% | 2.2% |
| DREC_M15K Daily RSI <=50 and rising + 15m Stochastic recovery above 10 | 394 | 35.5% | 31.0–40.4% | -71.82% | 0.605379343008261 | 71.82% | 13.5% |
| DREC_M15R Daily RSI <=50 and rising + 15m RSI recovery above 25 | 92 | 38.0% | 28.8–48.3% | -22.54% | 0.7071851195033502 | 26.94% | 4.1% |
| H4LOW_H1R 4H RSI <=35 + 1H RSI recovery above 30 | 172 | 34.9% | 28.2–42.3% | -53.66% | 0.6257003229341522 | 56.66% | 6.7% |
| H4LOW_H1DIV 4H RSI <=35 + Confirmed 1H bullish RSI divergence | 75 | 42.7% | 32.1–53.9% | -17.39% | 0.7356999601756317 | 29.55% | 2.9% |
| H4LOW_M15K 4H RSI <=35 + 15m Stochastic recovery above 10 | 228 | 36.4% | 30.4–42.8% | -50.42% | 0.7488013125457105 | 58.58% | 9.1% |
| H4LOW_M15R 4H RSI <=35 + 15m RSI recovery above 25 | 119 | 36.1% | 28.1–45.1% | -33.03% | 0.7429099496435422 | 41.04% | 5.2% |
| D_H4_H1R Daily RSI <=45 and 4H RSI <=40 + 1H RSI recovery above 30 | 126 | 39.7% | 31.6–48.4% | -28.76% | 0.7564289258841863 | 34.42% | 4.9% |
| D_H4_H1DIV Daily RSI <=45 and 4H RSI <=40 + Confirmed 1H bullish RSI divergence | 71 | 43.7% | 32.7–55.2% | -14.45% | 0.7591371833827278 | 22.65% | 2.7% |
| D_H4_M15K Daily RSI <=45 and 4H RSI <=40 + 15m Stochastic recovery above 10 | 242 | 38.0% | 32.1–44.3% | -40.53% | 0.8142449334983956 | 51.71% | 9.4% |
| D_H4_M15R Daily RSI <=45 and 4H RSI <=40 + 15m RSI recovery above 25 | 122 | 37.7% | 29.6–46.6% | -31.20% | 0.7578315885100567 | 38.23% | 5.3% |

## fullHistory

| Test | Trades | Win rate | Wilson 95% | Net return | PF | Max DD | Exposure |
|---|---:|---:|---:|---:|---:|---:|---:|
| D40_H1R Daily RSI <=40 + 1H RSI recovery above 30 | 288 | 45.1% | 39.5–50.9% | -10.82% | 0.9720638733965019 | 45.81% | 3.8% |
| D40_H1DIV Daily RSI <=40 + Confirmed 1H bullish RSI divergence | 259 | 46.3% | 40.4–52.4% | 0.85% | 1.0022250863184121 | 45.46% | 3.5% |
| D40_M15K Daily RSI <=40 + 15m Stochastic recovery above 10 | 964 | 38.1% | 35.1–41.2% | -94.07% | 0.803655937219322 | 95.81% | 11.4% |
| D40_M15R Daily RSI <=40 + 15m RSI recovery above 25 | 320 | 39.4% | 34.2–44.8% | -64.00% | 0.7608858765559432 | 64.37% | 4.5% |
| D35_H1R Daily RSI <=35 + 1H RSI recovery above 30 | 154 | 44.2% | 36.5–52.0% | 6.16% | 1.0270063366843905 | 37.80% | 2.1% |
| D35_H1DIV Daily RSI <=35 + Confirmed 1H bullish RSI divergence | 139 | 45.3% | 37.3–53.6% | 0.08% | 1.0003609913772578 | 37.29% | 1.9% |
| D35_M15K Daily RSI <=35 + 15m Stochastic recovery above 10 | 489 | 38.9% | 34.6–43.2% | -77.94% | 0.796736879489536 | 84.01% | 5.6% |
| D35_M15R Daily RSI <=35 + 15m RSI recovery above 25 | 169 | 37.9% | 30.9–45.4% | -45.84% | 0.8016425389864545 | 50.30% | 2.3% |
| DREC_H1R Daily RSI <=50 and rising + 1H RSI recovery above 30 | 122 | 40.2% | 31.9–49.0% | -14.32% | 0.8853388544529546 | 21.32% | 1.7% |
| DREC_H1DIV Daily RSI <=50 and rising + Confirmed 1H bullish RSI divergence | 153 | 45.1% | 37.4–53.0% | -30.52% | 0.774370771014725 | 43.01% | 2.1% |
| DREC_M15K Daily RSI <=50 and rising + 15m Stochastic recovery above 10 | 1146 | 35.5% | 32.8–38.3% | -98.46% | 0.74388546265202 | 98.90% | 12.7% |
| DREC_M15R Daily RSI <=50 and rising + 15m RSI recovery above 25 | 289 | 38.4% | 33.0–44.1% | -69.65% | 0.6256931893421898 | 71.43% | 4.0% |
| H4LOW_H1R 4H RSI <=35 + 1H RSI recovery above 30 | 520 | 39.4% | 35.3–43.7% | -85.09% | 0.7157446518840704 | 85.65% | 6.7% |
| H4LOW_H1DIV 4H RSI <=35 + Confirmed 1H bullish RSI divergence | 259 | 45.2% | 39.2–51.3% | -0.55% | 0.9984939539696905 | 43.22% | 3.7% |
| H4LOW_M15K 4H RSI <=35 + 15m Stochastic recovery above 10 | 666 | 38.1% | 34.5–41.9% | -90.52% | 0.743742712814967 | 91.33% | 8.9% |
| H4LOW_M15R 4H RSI <=35 + 15m RSI recovery above 25 | 381 | 40.4% | 35.6–45.4% | -73.70% | 0.7369029655491897 | 74.54% | 5.9% |
| D_H4_H1R Daily RSI <=45 and 4H RSI <=40 + 1H RSI recovery above 30 | 398 | 43.2% | 38.4–48.1% | -35.42% | 0.9209409499111011 | 50.01% | 4.9% |
| D_H4_H1DIV Daily RSI <=45 and 4H RSI <=40 + Confirmed 1H bullish RSI divergence | 248 | 46.8% | 40.7–53.0% | 25.96% | 1.068604730398488 | 36.81% | 3.4% |
| D_H4_M15K Daily RSI <=45 and 4H RSI <=40 + 15m Stochastic recovery above 10 | 743 | 38.8% | 35.3–42.3% | -80.58% | 0.8421359301182471 | 87.17% | 9.1% |
| D_H4_M15R Daily RSI <=45 and 4H RSI <=40 + 15m RSI recovery above 25 | 377 | 40.1% | 35.2–45.1% | -70.81% | 0.7395942098177221 | 71.38% | 5.2% |

## Definitions

- **D40_H1R**: Daily RSI <=40 + 1H RSI recovery above 30
- **D40_H1DIV**: Daily RSI <=40 + Confirmed 1H bullish RSI divergence
- **D40_M15K**: Daily RSI <=40 + 15m Stochastic recovery above 10
- **D40_M15R**: Daily RSI <=40 + 15m RSI recovery above 25
- **D35_H1R**: Daily RSI <=35 + 1H RSI recovery above 30
- **D35_H1DIV**: Daily RSI <=35 + Confirmed 1H bullish RSI divergence
- **D35_M15K**: Daily RSI <=35 + 15m Stochastic recovery above 10
- **D35_M15R**: Daily RSI <=35 + 15m RSI recovery above 25
- **DREC_H1R**: Daily RSI <=50 and rising + 1H RSI recovery above 30
- **DREC_H1DIV**: Daily RSI <=50 and rising + Confirmed 1H bullish RSI divergence
- **DREC_M15K**: Daily RSI <=50 and rising + 15m Stochastic recovery above 10
- **DREC_M15R**: Daily RSI <=50 and rising + 15m RSI recovery above 25
- **H4LOW_H1R**: 4H RSI <=35 + 1H RSI recovery above 30
- **H4LOW_H1DIV**: 4H RSI <=35 + Confirmed 1H bullish RSI divergence
- **H4LOW_M15K**: 4H RSI <=35 + 15m Stochastic recovery above 10
- **H4LOW_M15R**: 4H RSI <=35 + 15m RSI recovery above 25
- **D_H4_H1R**: Daily RSI <=45 and 4H RSI <=40 + 1H RSI recovery above 30
- **D_H4_H1DIV**: Daily RSI <=45 and 4H RSI <=40 + Confirmed 1H bullish RSI divergence
- **D_H4_M15K**: Daily RSI <=45 and 4H RSI <=40 + 15m Stochastic recovery above 10
- **D_H4_M15R**: Daily RSI <=45 and 4H RSI <=40 + 15m RSI recovery above 25
