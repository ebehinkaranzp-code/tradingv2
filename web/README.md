# Trading V2 dashboard

Open `index.html` in a modern browser or serve the `web` folder with any static HTTP server. No Node.js package install or exchange API key is needed.

## Market data behavior

The dashboard tries the latest valid GitHub snapshot first, then public Binance, Bybit, and Kraken spot candle endpoints directly from the browser, then the last validated browser-local cache. It refreshes every 60 seconds and has a manual Refresh data button. The source and snapshot timestamp are visible in the UI.

Only closed OHLCV candles that pass validation are used. If every live source fails, the dashboard labels cached data as offline/stale; if there is no valid cache, it shows that data is unavailable rather than inventing demo prices.

See [the market-data architecture](../docs/market-data.md) for the snapshot contract and Windows-client integration requirements.

This is an analysis-only dashboard. It does not connect to trading accounts, request API keys, or place orders.