#!/usr/bin/env python3
"""Fetch, validate and publish public spot candles with provider failover."""
import json, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OUT = Path("data/market")
SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
INTERVALS = ("15m", "1h", "4h", "1d")
DURATION_MS = {"15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000}

def get_json(url):
    req = Request(url, headers={"User-Agent": "TradingV2-MarketData/1.0", "Accept": "application/json"})
    with urlopen(req, timeout=18) as response:
        return json.loads(response.read().decode("utf-8"))

def validate(rows):
    if len(rows) < 30:
        raise ValueError(f"Only {len(rows)} closed candles returned")
    previous = -1
    for c in rows:
        values = (c["open"], c["high"], c["low"], c["close"], c["volume"], c["open_time"])
        if not all(isinstance(v, (int, float)) and v == v and abs(v) != float("inf") for v in values):
            raise ValueError("Non-finite candle value")
        if min(c["open"], c["high"], c["low"], c["close"]) <= 0 or c["volume"] < 0:
            raise ValueError("Non-positive OHLC or negative volume")
        if c["low"] > min(c["open"], c["close"]) or c["high"] < max(c["open"], c["close"]) or c["low"] > c["high"]:
            raise ValueError("Invalid OHLC relationship")
        if c["open_time"] <= previous:
            raise ValueError("Duplicate or out-of-order candle timestamp")
        previous = c["open_time"]
    return rows[-250:]

def binance(symbol, interval):
    url = "https://api.binance.com/api/v3/klines?" + urlencode({"symbol": symbol, "interval": interval, "limit": 251})
    now = int(time.time() * 1000)
    rows = get_json(url)
    candles = [{"open_time": int(r[0]), "open": float(r[1]), "high": float(r[2]), "low": float(r[3]), "close": float(r[4]), "volume": float(r[5]), "close_time": int(r[6])} for r in rows if int(r[6]) < now]
    return validate(candles), "binance"

def bybit(symbol, interval):
    iv = {"15m": "15", "1h": "60", "4h": "240", "1d": "D"}[interval]
    url = "https://api.bybit.com/v5/market/kline?" + urlencode({"category": "spot", "symbol": symbol, "interval": iv, "limit": 250})
    payload = get_json(url)
    if payload.get("retCode") != 0:
        raise ValueError("Bybit: " + str(payload.get("retMsg", "API error")))
    now, duration = int(time.time() * 1000), DURATION_MS[interval]
    candles = [{"open_time": int(r[0]), "open": float(r[1]), "high": float(r[2]), "low": float(r[3]), "close": float(r[4]), "volume": float(r[5]), "close_time": int(r[0]) + duration - 1} for r in payload["result"]["list"] if int(r[0]) + duration <= now]
    candles.sort(key=lambda c: c["open_time"])
    return validate(candles), "bybit"

def kraken(symbol, interval):
    pair = ("XBT" + symbol[3:]) if symbol.startswith("BTC") else symbol
    iv = {"15m": 15, "1h": 60, "4h": 240, "1d": 1440}[interval]
    url = "https://api.kraken.com/0/public/OHLC?" + urlencode({"pair": pair, "interval": iv})
    payload = get_json(url)
    if payload.get("error"):
        raise ValueError("Kraken: " + "; ".join(payload["error"]))
    result = payload.get("result", {})
    key = next((k for k in result if k != "last"), None)
    if not key:
        raise ValueError("Kraken returned no OHLC series")
    now, duration = int(time.time() * 1000), DURATION_MS[interval]
    candles = [{"open_time": int(float(r[0]) * 1000), "open": float(r[1]), "high": float(r[2]), "low": float(r[3]), "close": float(r[4]), "volume": float(r[6]), "close_time": int(float(r[0]) * 1000) + duration - 1} for r in result[key] if int(float(r[0]) * 1000) + duration <= now]
    return validate(candles), "kraken"

def fetch(symbol, interval):
    failures = []
    for provider in (binance, bybit, kraken):
        try:
            candles, source = provider(symbol, interval)
            payload = {
                "schema_version": 1, "exchange": source, "market_type": "spot",
                "symbol": symbol, "interval": interval,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "candles": candles,
            }
            OUT.mkdir(parents=True, exist_ok=True)
            target = OUT / f"{symbol}_{interval}.json"
            target.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
            print(f"published {target}: {len(candles)} closed candles via {source}")
            return True
        except Exception as exc:
            failures.append(f"{provider.__name__}: {exc}")
            print(f"WARNING: {symbol} {interval} {failures[-1]}", file=sys.stderr)
    print(f"ERROR: all providers failed for {symbol} {interval}", file=sys.stderr)
    return False

def main():
    successes = sum(fetch(symbol, interval) for symbol in SYMBOLS for interval in INTERVALS)
    if successes == 0:
        raise SystemExit("All providers failed; existing snapshots were left untouched.")
    print(f"Published {successes}/{len(SYMBOLS) * len(INTERVALS)} market snapshots.")

if __name__ == "__main__":
    main()
