# Trading V2

An independent browser-based market-analysis terminal. The current dashboard is a static HTML application in `web/index.html`; it does not embed TradingView and does not place real exchange orders.

## Current implementation

- **Market data:** Binance Spot public REST endpoints and the Binance Spot kline WebSocket. Candle rows are validated for finite OHLCV values and valid high/low ranges. REST history is used on initial load and as a fallback when the stream is unavailable or stale.
- **Chart:** 1m, 5m, 15m, 1h, 4h, 1d and 1w intervals; candlestick/line modes; EMA 20, EMA 50 and Donchian overlays; pan, zoom, crosshair and local horizontal levels.
- **Watchlist:** BTCUSDT, ETHUSDT, SOLUSDT and BNBUSDT, refreshed from REST ticker data every 15 seconds.
- **Order book and tape:** REST snapshots, refreshed every 5 seconds and 4 seconds respectively. These are polling views, not a depth-diff or trade WebSocket feed.
- **Footprint:** aggregated from the latest 1,000 Binance aggregate trades. It is not a complete historical footprint or exchange-provided volume-at-price feed.
- **Market profile:** estimated distribution from candle OHLCV ranges. It is explicitly approximate and is not tick-accurate TPO or volume-at-price.
- **Paper trading:** local browser simulation with separate positions by symbol and partial-close realized P&L. It does not send orders to an exchange and currently applies no fees or slippage.
- **Journal and drawings:** stored in the current browser's local storage; they are not synced to a server.
- **Research engines:** the Quattro and momentum engines are present in `web/analysis-legacy.html`. The strategy cards in the current dashboard are informational and are not a live backtest interface. The legacy research page requires suitable imported historical data before it can calculate its strategies.

## Run the dashboard locally

No frontend package install or build step is required for the current static dashboard.

```bash
python -m http.server 8000 --directory web
```

Open [http://localhost:8000](http://localhost:8000). The browser needs internet access to Binance public market-data endpoints. No Binance API key is required for these public market-data calls.

## Tests

Run from the repository root with Node.js 22 or newer:

```bash
node --test web/dashboard.test.cjs
```

The GitHub Actions workflow `.github/workflows/dashboard-check.yml` extracts and syntax-checks the dashboard script and runs the Node test suite. The tests cover CSV/history helpers, candle validation, continuity, the isolated strategy engines, footprint level ranking, paper-account calculations and local-state recovery. They do not replace browser end-to-end testing or live exchange verification.

## Local Edge coding agent

The optional `edge-agent/` folder contains a local Python service and an Edge extension. It is an early beta and is not required to run the dashboard.

- Windows 10/11, Python 3.10+, Git and Microsoft Edge.
- A local Jan server exposing an OpenAI-compatible API at `http://127.0.0.1:1337/v1`.
- Setup and pairing instructions: [edge-agent/README.md](edge-agent/README.md).
- The agent is restricted to repository file operations and predefined validation commands. It does not place trades, deploy, merge or push changes.
- The configured run limit is at most seven hours; the computer, Jan server and agent process must remain running.

## Deployment status and known limitations

- `.github/workflows/publish-site.yml` deploys the `web/` folder only when changes are pushed to `main`. Work on `agent/edge-local-agent` is not published automatically.
- The current dashboard is a Binance Spot research build. It is not a broker, exchange, portfolio custodian or financial adviser.
- The current dashboard does not provide a production-grade strategy backtester, futures/perpetual order book, tick-accurate historical footprint, NeoWave engine or real order execution.
- The root Cargo/Docker files describe a Rust service layout, but the Rust `crates/` and `bins/` source trees are not present in this branch. A Rust/Docker build is therefore not currently a verified way to run this version.
- Browser interaction, responsive behavior across real devices, and live exchange connectivity still require end-to-end testing in a browser with network access.

All displayed market data should be treated as unavailable when the exchange feed fails; do not substitute fabricated prices or candles.
