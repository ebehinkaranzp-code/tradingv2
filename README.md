# Trading V2

Trading V2 is the user's independent trading-research and terminal project. It is being developed separately from the local Windows installation work.

> **Current status:** foundation / prototype stage. The repository does not yet contain a complete runnable trading terminal. Do not treat the prototype's sample prices or status labels as live market data or real system health.

## What is in this repository now

- `prototype/index.html` — a static UI concept for a multi-panel trading terminal. Its displayed prices, market status, order book and signals are illustrative placeholders.
- `trading_v2_mcp.py` — a standard-library Python MCP server for reading and writing repository files and managing branches / pull requests through a configured GitHub token.
- Rust workspace manifests and Docker/PostgreSQL configuration copied from the upstream Tradoor project. The full upstream source tree (including `crates/`, `bins/`, `web/` and `scripts/`) is **not currently present** in this repository, so those manifests do not make this repository buildable by themselves.

## Project direction

The intended product is a research-first crypto trading terminal with:

1. Multi-exchange market data and a clear data-source / freshness indicator.
2. Interactive charts, watchlists and market overview.
3. A strategy engine with explicit, versioned strategy definitions.
4. Historical backtesting with fees, slippage, funding and out-of-sample validation.
5. Portfolio, position sizing and risk controls.
6. Paper trading and a complete audit journal.
7. Optional execution only after independent safety checks and explicit configuration.

The first usable release should be **research and paper-trading only**. Live order execution must remain disabled by default and must not be enabled by an LLM or UI shortcut.

## Architecture and delivery plan

See [Integration Plan](docs/INTEGRATION_PLAN.md) for component ownership, the staged build sequence, and the Tradoor integration boundary.

## Local prototype

Open `prototype/index.html` in a browser to inspect the static concept. It does not connect to an exchange, place orders, or calculate real-time signals.

## Development principles

- Keep `main` stable; work on feature branches and use pull requests.
- Never commit API keys, exchange secrets, private datasets, account identifiers, or runtime logs.
- Treat all market data as untrusted until timestamp, source, symbol and integrity checks pass.
- Keep backtest results reproducible and include transaction costs.
- Separate signal generation, risk approval, paper execution and any future live execution.
- Never claim profitability or production readiness without reproducible evidence.

## Upstream Tradoor

The Tradoor terminal is an independent upstream project. Its code is licensed under AGPL-3.0-only. Any code imported from it must retain the applicable license notices and comply with the license. This repository's current manifests/configuration are not a complete import of Tradoor.

- Upstream: https://github.com/tradoor-terminal/tradoor
- Upstream license: AGPL-3.0-only

## Disclaimer

This software is for engineering, research and testing. It is not financial advice. Trading digital assets involves substantial risk. No performance or profitability is promised.
