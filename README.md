# Trading V2

Trading V2 is being built as a specialist market-analysis and signal-research application. It validates market data, calculates technical indicators, evaluates strategy evidence and reports historical performance. **Live trading and order execution are explicitly out of scope.** The current repository is a work in progress, not a finished product.

## Current implementation

- `services/strategy/legacy/`: preserved JavaScript implementation of the existing Quattro Donchian v2 and Momentum + Volatility Targeting signals, with synthetic-data regression tests.
- `services/strategy/legacy/market-data-validation.js`: fail-closed validation for closed, fresh, ordered, gap-free candles.
- `rust/crates/trading-domain/`: dependency-free Rust analysis core for candle validation, EMA/ATR/RSI/MACD/Bollinger/OBV indicators, explainable confluence scoring, analytical risk calculations and an initial single-position historical simulator.
- `.github/workflows/strategy-engine-tests.yml`: JavaScript regression CI.
- `.github/workflows/rust-domain.yml`: Rust formatting, tests and Clippy CI.

## Build and test

Requires a stable Rust toolchain:

```sh
cargo fmt --all
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
```

The legacy signal engine tests require Node.js 22 or newer:

```sh
node --test services/strategy/legacy/*.test.cjs
```

## Architecture and safety boundaries

1. Market data is validated before it reaches a strategy.
2. Strategies calculate signals; they do not submit orders.
3. Risk calculations are analytical estimates for evaluating hypothetical setups. They do not authorize or initiate execution. There is no broker/exchange order path, account management or trading credential storage.
4. Historical data must have documented provenance and a license suitable for its intended use. The legacy Coin Metrics CSV files are deliberately not copied into this repository because their source identifies CC BY-NC 4.0 terms.
5. Strategy performance must be evaluated with out-of-sample walk-forward tests, realistic fees, slippage, funding and survivorship-aware data before any claim of profitability.

## Upstream reference

The charting project [tradoor-terminal/tradoor](https://github.com/tradoor-terminal/tradoor) is an upstream reference only. Its source is licensed under AGPL-3.0-only. It has not been fully imported or integrated into this repository; do not assume the upstream web application, exchange feeds, database, or chart engine are present here.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the implemented data flow, component boundaries, risk contracts and production-readiness requirements.

## Roadmap

- Complete native Rust strategy implementations with parity tests against the legacy engine.
- Add audited market-data ingestion for analysis, provenance tracking and persistent data-quality monitoring.
- Extend the initial simulator into a robust backtest and walk-forward/out-of-sample research suite.
- Add signal explanations, quality diagnostics and regime-aware analysis; calibrate scores only against held-out data.
- Build the analytical dashboard and deployment pipeline only after the backend contracts and tests are stable.

## License

This project is licensed under AGPL-3.0-only. See [LICENSE](LICENSE).
