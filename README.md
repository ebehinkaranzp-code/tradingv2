# Trading V2 — Full Market Analysis Terminal

This repository integrates a pinned copy of the Tradoor terminal engine and interface. The product is **research-only**: live exchange account creation, wallet/key import, signing, order placement, cancellation, leverage changes, exits and live algos are disabled by a build-time safety patch. Market-data streams and analytical tools remain available. No real trading is part of this project.

The upstream source is included as the `tradoor-source` Git submodule at a fixed commit. It is licensed under **AGPL-3.0-only**; this repository keeps the corresponding license and publishes the build-time modifications.

## Run the complete application

1. Clone with its source submodule: `git clone --recurse-submodules https://github.com/ebehinkaranzp-code/tradingv2.git`
2. Copy `.env.example` to `.env` and set a long random `POSTGRES_PASSWORD`.
3. Build and start: `docker compose up --build -d`.
4. Open `http://localhost:8080`.

The complete application includes its API server, PostgreSQL persistence and market-data recorder. GitHub Pages alone cannot host those server/database services, so the full terminal is packaged as a Docker application. Put an HTTPS reverse proxy in front before exposing it publicly.

## Research-only safety

The build applies `scripts/disable-live-trading.py` to the pinned upstream source. It removes account-creation/settings entry points, removes Trade and Positions panels from the panel picker, and makes all order-capable client functions reject before any worker/network request. The CI workflow checks these safety conditions before building.
## Included analysis modules

- Tradoor's native multi-chart workspace, WebGL2 chart renderer, drawing tools, Footprint/Order Flow, DOM, Tape, TPO/Market Profile, Frost Script, backtesting and research journal.
- A dedicated Research Lab running the preserved Quattro Donchian v2 engine on BTC perpetual 4H + 1D data (minimum 40 and 220 continuous closed candles).
- TSMOM + volatility targeting for BTC and ETH spot, requiring 1,500 continuous closed daily candles and a valid walk-forward training window.
- Paper Trading is the Training simulator, with virtual positions and fills at live market prices; it is separate from exchange accounts and cannot place real orders.

The Research Lab reads public Binance market data directly. It does not use GitHub as a price feed, does not fill missing candles with synthetic data, and blocks a strategy result when gaps, duplicates, invalid OHLCV or stale data are detected. Weekly chart history is folded from seven complete UTC daily candles wherever the venue provides daily history.

NEoWave is reserved as an independent engine extension point. No automatic wave count is shown until its rules and validation tests are implemented.
