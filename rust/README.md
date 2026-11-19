# Trading V2 Rust domain core

This is an isolated, dependency-free Rust workspace. It does not depend on the incomplete Tradoor upstream workspace at the repository root, so it can be compiled and tested independently while the full application architecture is assembled.

## Included

- Closed-candle validation: OHLC consistency, finite values, strictly increasing timestamps, exact intervals, minimum history and freshness.
- Pure risk assessment: stop-side validation, fee-aware risk sizing, notional/leverage cap, daily loss guard and peak-to-equity drawdown guard.
- No exchange clients, network access, credential handling, or order submission.

## Test

With Rust 1.75 or newer:

```sh
cargo test --manifest-path rust/Cargo.toml --locked
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
```

Risk defaults are intentionally conservative (1% risk per proposal, 3% daily loss stop, 10% peak drawdown stop, 1x gross leverage). These are software defaults, not personalized investment advice. The caller must maintain trustworthy equity/session/peak state and must not treat a returned proposal as authorization to execute.

## Important boundary

This crate is not a complete trading system, exchange integration, or proof of strategy profitability. Live trading remains out of scope. Paper execution, audited historical data, walk-forward evaluation, persistence and independent risk review are still required.
