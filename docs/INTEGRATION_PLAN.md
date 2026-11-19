# Trading V2 — Integration Plan

## 1. Current verified repository state

The default branch currently contains root-level Rust workspace manifests, a Docker Compose file for PostgreSQL, an environment template, a Python MCP server, and a README that previously described the upstream Tradoor product. It does **not** contain the Rust workspace members, web application, generated WebAssembly package, or build scripts required to build Tradoor.

The branch `import/tradoor-upstream` currently adds only `prototype/index.html` beyond the shared root files. That HTML is a static concept, not a working market terminal. Its prices, order book, signals and “market live” labels are mock presentation data.

This distinction is important: a manifest or a prototype is not proof that the application is installed, running, connected to exchanges, or safe to trade.

## 2. Product boundary

Trading V2 is the product and owns:
- strategy definitions, versions and parameter sets;
- research jobs and reproducible backtests;
- portfolio/risk policy and approval records;
- paper-trading state and audit journal;
- user-facing workflow and configuration.

Tradoor may be used as a charting / market-visualization foundation. It must not silently become the owner of Trading V2 strategy decisions or risk authority.

## 3. Proposed component layout

```text
Trading V2
├── apps/
│   └── terminal/             # Trading V2 UI and navigation
├── services/
│   ├── market-data/          # Exchange adapters, normalization, freshness
│   ├── strategy/             # Versioned signal calculations
│   ├── backtest/             # Deterministic historical simulation
│   ├── risk/                 # Independent pre-trade and portfolio limits
│   └── paper-execution/      # Simulated fills and journal
├── integrations/
│   └── tradoor/              # Explicit adapter / integration boundary
├── crates/                   # Rust components only where justified
├── docs/
└── tests/
```

This is a target layout, not a claim that these directories already exist.

## 4. Staged implementation

### Stage A — repository truth and safety
- Keep the default branch stable.
- Document what is actually present and what is placeholder.
- Keep secrets out of Git and make paper-only behavior the default.
- Add CI checks for formatting, type checks, unit tests and dependency/build validation.

### Stage B — restore a reproducible Tradoor source dependency
- Pin an exact upstream commit or release; do not import a moving `main` branch blindly.
- Bring the complete source tree into a clearly isolated integration boundary (submodule, subtree, or a documented vendor import).
- Preserve AGPL-3.0-only notices and review distribution obligations before publishing a combined derivative.
- Build the upstream project independently before making Trading V2 changes.
- Record the exact upstream revision and local patches.

### Stage C — market data contract
- Define a canonical candle/trade/order-book schema with exchange, market type, symbol, event time, receive time and source.
- Add reconnect, rate-limit, stale-data and gap handling.
- Never mix mock and live data without an unmistakable UI label.

### Stage D — strategy and backtesting
- Port the user's existing strategy only after retrieving and reviewing the original strategy files.
- Version strategy code and parameters.
- Include fees, slippage, funding, latency assumptions and conservative fill rules.
- Use train/validation/test or walk-forward splits; do not tune on the final holdout.
- Store input-data identifiers and run configuration with every result.

### Stage E — risk and paper trading
- Enforce maximum position size, per-trade risk, daily loss, drawdown and exposure limits in a backend risk service.
- Keep the risk service independent from strategy suggestions.
- Paper execution is the only supported execution mode initially.
- Record every signal, rejection, simulated order, fill and state transition.

### Stage F — controlled release
- Run regression tests and replay tests.
- Verify data freshness and failure behavior.
- Publish a release checklist and known limitations.
- Any future live execution requires a separate security review, explicit user opt-in, exchange permission scoping and a kill switch. It is out of scope for the initial release.

## 5. Acceptance gates

A stage is not complete merely because files exist. Each stage needs:
- reproducible commands;
- automated tests or a documented manual verification;
- known limitations;
- no committed credentials;
- clear separation of sample data from real market data.

## 6. Immediate next tasks

1. Pin the upstream Tradoor revision and import the complete source tree to the integration branch.
2. Build Tradoor without Trading V2 modifications and record the actual result.
3. Decide whether the UI will embed selected Tradoor chart components or use a separate chart adapter.
4. Define Trading V2's market-data and strategy interfaces before connecting the UI.
5. Recover and review the existing strategy implementation before porting it; do not recreate it from memory.
