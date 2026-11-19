# Trading V2 architecture and delivery boundaries

## Product scope

Trading V2 is a specialist market-analysis and signal-research application. It analyzes market data, explains candidate setups, scores signal quality and evaluates strategies. It does **not** place orders, manage exchange accounts or execute live trades. No exchange trading adapter, order-submission path, API-key storage or live execution workflow is in scope.

## Analysis pipeline

```text
Market-data ingestion (planned; no live source connected yet)
        |
        v
Strict candle validation
  - OHLC integrity and finite values
  - completed bars only
  - ordered timestamps and interval continuity
  - freshness and provenance checks
        |
        v
Feature / indicator calculations
  - EMA / Wilder ATR / RSI / MACD / Bollinger Bands / OBV
  - trend, breakout, momentum and volatility features
  - multi-timeframe context
        |
        v
Strategy signal generation
  - legacy JS reference: Quattro Donchian v2 / Momentum + volatility targeting
  - Rust primitives: Quattro conditions / momentum exposure
        |
        v
Signal confluence scoring (initial implementation)
  - direction, trigger, invalidation and rationale
  - signed evidence score with weighted component breakdown
  - explicit no-signal state
        |
        v
Historical evaluation
  - deterministic backtest simulator (implemented, limited)
  - walk-forward / out-of-sample validation (planned)
        |
        v
Research reports and analytical UI (planned)
```

## Implemented now

| Component | Status | Boundary |
|---|---|---|
| Legacy JS signal engine | Present | Calculates signals only |
| JS candle validation | Present | Rejects stale, unfinished, gapped or malformed bars |
| Rust candle validation | Present | Fail-closed data boundary for Rust callers |
| Rust EMA / ATR | Present | Deterministic indicator primitives |
| Rust technical indicators | Initial implementation | Wilder RSI, MACD, Bollinger Bands and OBV with explicit warm-up handling |
| Rust Quattro signal | Partial | Breakout/exit conditions and completed-daily EMA200 filter; not the full pyramiding state machine |
| Rust momentum exposure | Partial | Long-only volatility-targeted exposure; not walk-forward parameter selection |
| Rust signal assessment | Initial implementation | Weighted trend/momentum/breakout/volume/timeframe evidence with volatility-quality gate; configurable weights, not calibrated |
| Rust risk assessment | Present | Research sizing/risk calculation only; no execution authority |
| Rust historical simulator | Initial implementation | One position at a time; next-bar-open signals, gap-aware stops, fee/slippage assumptions and end-of-data liquidation |
| Signal confluence scoring | Initial implementation | Configurable weighted evidence score; not a probability or calibrated confidence |
| Market-data source integration | Not implemented | No exchange market-data connection yet |
| Walk-forward / out-of-sample suite | Not implemented | No profitability or predictive edge claim |
| Research dashboard / web terminal | Not implemented | No deployable app or Docker image |
| Live trading / order execution | Explicitly out of scope | No order submission, account management or exchange trading credentials |

## Required contracts

### Market data

All timestamps are UTC Unix milliseconds. A candle's timestamp is its opening time. A candle is eligible only after `timestamp + interval <= now`. Inputs must be ordered, contiguous and fresh. Do not interpolate missing bars or silently drop malformed bars. Record source, instrument, timeframe, retrieval time and dataset/license provenance.

The caller supplies `now_ms` and freshness limits explicitly. Do not read an implicit local clock inside deterministic strategy or risk functions.

### Strategies and signals

Strategy functions are pure calculations over closed candles. They must not import exchange clients, environment variables, secrets, filesystem APIs or network clients. Strategy output is an analytical signal, never an order. A signal should eventually expose direction, trigger conditions, invalidation level, timeframe, timestamp, rationale and the contributing indicator values. When evidence is insufficient or conflicting, return an explicit no-signal state rather than forcing a trade idea.

The JavaScript implementation is the legacy reference. Rust parity work must compare outputs across the same deterministic candle fixtures before replacing it.

### Risk analytics

Risk calculations are analytical estimates for evaluating a hypothetical setup. They do not authorize execution. Historical and analytical reports must clearly disclose assumptions about fees, slippage, leverage and position sizing. Never imply that a risk limit guarantees a maximum realized loss during gaps or illiquid conditions.

### Backtesting

The current simulator is deliberately limited to one open position at a time and is not yet a production-grade research engine. A robust evaluation suite must use:
- next-bar execution (not same-bar lookahead);
- instrument-specific fees, spread, slippage and funding assumptions;
- documented stop/target collision rules, using lower-timeframe data where available;
- out-of-sample walk-forward evaluation and parameter freeze;
- drawdown, exposure, turnover, trade count, benchmark and regime reporting;
- dataset provenance, licensing and reproducible configuration snapshots;
- checks for survivorship bias, lookahead bias and overfitting.

## Build and tests

```sh
cargo fmt --all
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
node --test services/strategy/legacy/*.test.cjs
```

Rust CI formats the source, runs Rust unit tests and runs Clippy with warnings denied. The JavaScript strategy workflow runs deterministic regression tests.

## Deployment policy

A deployable container and public website are intentionally deferred. The previously imported Docker configuration referenced Tradoor binaries, migrations and web assets that are not part of Trading V2; those broken files have been removed rather than presenting an unbuildable deployment path.
