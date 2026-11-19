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