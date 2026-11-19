# Trading V2

Trading V2 is an experimental trading-research and risk-management project. It is being built separately from the Tradoor charting codebase.

## Current preview

The current GitHub Pages preview is a **static UI concept**, not a functioning trading terminal.

- Entry point: [prototype/index.html](prototype/index.html)
- Market prices, order-book rows, chart candles, trades, and AI insights shown in the prototype are illustrative placeholders.
- No live market-data connection is active in this preview.
- No exchange credentials are collected or stored.
- Order buttons are demo-only; no real orders are sent.
- No automated trading or financial advice is provided.

Do not use values shown in the prototype to make trading decisions.

## Project direction

The intended architecture separates these concerns:

1. Market-data ingestion and normalization.
2. Strategy research and signal generation.
3. Historical backtesting with fees, slippage, and out-of-sample evaluation.
4. Risk controls and position sizing.
5. Paper execution and trade journaling.
6. Optional exchange integrations, disabled by default and added only after safety and testing gates.

The strategy and risk engine belong to Trading V2. Tradoor may be evaluated as a charting/visualization component; it is not the source of Trading V2's strategy rules or risk decisions.

## Safety principles

- Research and paper trading come before live execution.
- Live execution must remain disabled unless explicitly configured and separately approved.
- Never commit API keys, passwords, seed phrases, or exchange credentials.
- Never expose a local control service to the public internet.
- No arbitrary shell execution, privilege escalation, or access to unrelated devices.
- Risk limits must be enforced independently of strategy signals.

## Jan / local MCP integration

`trading_v2_mcp.py` is a small MCP server for **GitHub repository operations only**. It does not expose the Windows filesystem, CMD, PowerShell, or other devices.

Security defaults:
- Reads use the configured `GITHUB_BRANCH` (defaults to `main`).
- Every write must name a branch under `work/*`; protected branches such as `main` are rejected.
- Secret files (`.env*`, private-key files) and GitHub workflow configuration paths are blocked.
- Use a fine-grained GitHub token limited to this repository, with Contents read/write and Pull requests read/write only. Do not grant Actions, Administration, or organization permissions.
- Store the token in Jan's MCP environment configuration. Never paste it into chat, source code, or a committed config file.

When calling write tools, explicitly pass a work branch `work/jan-agent-safe` (already created for this integration). Create that branch from `main` first, review changes, then open a pull request. Do not enable automatic merging.

## Repository status

This repository is under active construction. The preview must not be mistaken for a production application. Build instructions and architecture are added as the implementation becomes reproducible.

## License and upstream attribution

Any Tradoor-derived code must retain its upstream notices and comply with its AGPL-3.0-only license. Keep imported upstream code isolated from Trading V2's strategy and risk modules, and review license obligations before redistribution.

---

**Status:** experimental preview · static mock data · no live trading
