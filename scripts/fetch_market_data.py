#!/usr/bin/env python3
"""Fetch public spot candles and publish validated GitHub data snapshots."""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

OUT = Path("data/market")
SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
INTERVALS = ("15m", "1h", "4h", "1d")
BASE = "https://api.binance.com/api/v3/klines"

def fetch(symbol, interval):
    url = f"{BASE}?symbol={symbol}&interval={interval}&limit=251"
    req = Request(url, headers={"User-Agent": "TradingV2-MarketData/1.0"})
    with urlopen(req, timeout=20) as response:
        rows = json.loads(response.read().decode("utf-8"))
    # The last Binance kline may still be forming. Publish closed candles only.
    now_ms = int(time.time() * 1000)
    candles = []
    for row in rows:
        candle = {
            "open_time": int(row[0]), "open": float(row[1]),
            "high": float(row[2]), "low": float(row[3]),
            "close": float(row[4]), "volume": float(row[5]),
            "close_time": int(row[6]),
        }
        if candle["close_time"] < now_ms:
            if not all(map(lambda x: isinstance(x, (int, float)) and x == x and abs(x) != float("inf"),
                           (candle["open"], candle["high"], candle["low"], candle["close"], candle["volume"]))):
                raise ValueError("Non-finite candle value")
            if candle["low"] > min(candle["open"], candle["close"]) or candle["high"] < max(candle["open"], candle["close"]) or candle["low"] > candle["high"] or candle["volume"] < 0:
                raise ValueError("Invalid OHLCV candle")
            candles.append(candle)
    if len(candles) < 30:
        raise ValueError(f"Only {len(candles)} closed candles returned")
    payload = {
        "schema_version": 1, "exchange": "binance", "market_type": "spot",
        "symbol": symbol, "interval": interval,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "candles": candles[-250:],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{symbol}_{interval}.json"
    target.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"published {target}: {len(payload['candles'])} closed candles")

def main():
    failures = []
    for symbol in SYMBOLS:
        for interval in INTERVALS:
            try:
                fetch(symbol, interval)
            except Exception as exc:
                failures.append(f"{symbol} {interval}: {exc}")
                print(f"WARNING: {failures[-1]}", file=sys.stderr)
    if len(failures) == len(SYMBOLS) * len(INTERVALS):
        raise SystemExit("All market-data requests failed; existing snapshots were left untouched.")
    if failures:
        print(f"Completed with {len(failures)} failed market snapshots; successful snapshots were retained.")

if __name__ == "__main__":
    main()
