# Footprint research layer

This is a separate feature-engineering layer for Trading V2. It consumes historical Binance Spot aggTrades records and aggregates actual buyer/seller aggressor volume into candle windows.

## Trade-side interpretation
- is_buyer_maker = false: buyer was aggressive (market buy).
- is_buyer_maker = true: seller was aggressive (market sell).
- Delta = aggressive buy volume minus aggressive sell volume.
- The code never guesses trade direction from candle color.

## Included features
Delta ratio, buy-volume share, total volume, trade count, five-candle delta imbalance, rolling cumulative delta, and simple absorption candidates. Absorption flags are weak heuristics: aggressive volume with little candle-body progress is not proof of hidden liquidity or a reversal.

## Run locally
    python engine/footprint.py --candles data/BTCUSDT-1d.csv --trades data/BTCUSDT-aggTrades.csv --output research/results/btc-footprint-features.json
    python -m unittest engine/test_footprint.py -v

The aggTrades input must be a chronological CSV with price, quantity, transact_time (or timestamp/time), and is_buyer_maker headers. Public archive files can be very large; keep raw trade data outside Git.

## Research protocol
Compare the original OHLCV model against the same model plus footprint features on identical walk-forward years, labels, execution assumptions, and costs. Only use candles with actual trade coverage; missing footprint data is not zero delta. Keep a final untouched period for confirmation. Footprint can improve order-flow context but cannot guarantee profitability.
