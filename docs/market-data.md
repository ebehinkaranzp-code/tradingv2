# Market data pipeline

Trading V2 is analysis-only. It never sends orders and never needs exchange API keys.

## Source priority

Both the browser dashboard and the planned Windows client use this order:

1. GitHub snapshot: `data/market/{SYMBOL}_{INTERVAL}.json` from the repository (try the working branch and then `main`; prefer the newest valid `fetched_at`).
2. Direct public market-data fallback: Binance, then Bybit, then Kraken. These are public spot OHLC endpoints; no credentials are sent.
3. Last validated local cache. The UI must label cached data as offline/stale and show its timestamp.

A failed provider is not treated as a zero price or synthetic market data. If no validated source exists, show “data unavailable”.

## Snapshot format

Each JSON snapshot contains `schema_version`, `exchange`, `market_type`, `symbol`, `interval`, `fetched_at`, and a chronological `candles` array. Candle fields are `open_time`, `open`, `high`, `low`, `close`, `volume`, and `close_time`. Only closed candles are published. OHLC relationships, finite numbers, positive prices, nonnegative volume, ordering, and minimum history length are validated before use.

## GitHub Actions

`.github/workflows/market-data.yml` fetches BTCUSDT, ETHUSDT, and SOLUSDT at 15m, 1h, 4h, and 1d intervals. It tries multiple public providers independently for every symbol/interval and commits successful snapshots. The schedule is every five minutes. GitHub only runs scheduled workflows from the repository's default branch; a push or manual dispatch can run it on the working branch before merge.

## Clients

The web client and Windows client must consume these same snapshot URLs and use the same candle schema and validation rules. If direct provider access is blocked by CORS, network policy, or regional restrictions, the client proceeds to the next provider and then its local cache. A client cannot refresh new data while every route is unreachable; it can only keep showing its last validated cache with a clear stale indicator.

## Limitations

GitHub snapshots are periodic, not streaming. Their freshness depends on the Actions schedule, provider availability, and repository publication. Public exchange endpoints may be region-restricted or rate-limited. Never interpret a cached candle as live. The analysis application must remain read-only and must not request trading permissions.
