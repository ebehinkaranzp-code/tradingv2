# Trading V2 architecture and delivery boundaries

## Current execution path

```text
Market-data source (not connected yet)
        |
        v
Candle validation
  - OHLC integrity
  - closed bars only
  - monotonic timestamps
  - no gaps
  - freshness window
        |
        v
Strategy calculations
  - legacy JS engine: Quattro Donchian v2 / Momentum + volatility targeting
  - Rust primitives: EMA / Wilder ATR / Quattro conditions / momentum exposure
        |
        v
Portfolio risk assessment
  - stop direction and stop distance
  - fees included in risk estimate
  - per-proposal risk ceiling
  - aggregate open risk and notional
  - daily loss / peak drawdown guards
  - leverage ceiling
        |
        v
Risk-bounded proposal (no order is sent)
        |
        v
Paper execution + portfolio ledger (planned)
        |
        v
Backtest reports / terminal UI (planned)
```

## Implemented now

| Component | Status | Boundary |
|---|---|---|
| Legacy JS signal engine | Present | Calculates signals only |
| JS candle validation | Present | Rejects stale, unfinished, gapped or malformed bars |
| Rust candle validation | Present | Same fail-closed data boundary for Rust callers |
| Rust EMA / ATR | Present | Deterministic indicator primitives |
| Rust Quattro signal | Partial | Breakout/exit conditions and completed-daily EMA200 filter; not the full pyramiding state machine |
| Rust momentum exposure | Partial | Long-only volatility-targeted exposure; not walk-forward parameter selection |
| Rust risk assessment | Present | Produces bounded quantity proposal only |
| Exchange adapters | Not implemented | No exchange network calls or credentials |
| Paper execution / ledger | Not implemented | No simulated fills or persistent portfolio state yet |
| Full backtester | Not implemented | No profitability claims |
| Web terminal | Not implemented | No deployable app or Docker image |

## Required contracts

### Market data

All timestamps are UTC Unix milliseconds. A candle's timestamp is its opening time. A candle is eligible only after `timestamp + interval <= now`. Inputs must be ordered, contiguous and fresh. Do not interpolate missing bars or silently drop malformed bars.

The caller supplies `now_ms` and freshness limits explicitly. Do not read an implicit local clock inside deterministic strategy or risk functions.

### Strategies

Strategy functions are pure calculations over closed candles. They must not import exchange clients, environment variables, secrets, filesystem APIs, or network clients. Strategy output is a signal, never an order.

The JavaScript implementation is the legacy reference. Rust parity work must compare outputs across the same deterministic candle fixtures before replacing it.

### Risk

`PortfolioState` must be populated from an authoritative ledger. In particular, `open_notional` and `open_risk` must include every open position and be updated atomically as positions change. If those values are missing, stale or inconsistent, the caller must reject new proposals.

A `RiskProposal` is not execution authorization. A future paper-execution adapter must re-check the proposal against the latest portfolio version, apply idempotency keys, record simulated fills and fees, and reject stale proposals.

### Backtesting

A production-grade backtest must use:
- next-bar execution (not same-bar lookahead);
- exchange-specific fees, spread, slippage and funding;
- stop/target collision rules using lower-timeframe data where available;
- out-of-sample walk-forward evaluation and parameter freeze;
- drawdown, exposure, turnover, trade count and benchmark reporting;
- dataset provenance and license records.

## Build and tests

```sh
cargo fmt --all
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
node --test services/strategy/legacy/*.test.cjs
```

Rust CI formats the source, runs all Rust unit tests, and runs Clippy with warnings denied. The JavaScript strategy workflow runs its deterministic regression tests.

## Deployment policy

A deployable container and public website are intentionally deferred. The previously imported Docker configuration referenced Tradoor binaries, migrations and web assets that are not part of Trading V2; those broken files have been removed rather than presenting an unbuildable deployment path.
