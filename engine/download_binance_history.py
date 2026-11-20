#!/usr/bin/env python3
"""Download Binance public BTCUSDT spot OHLCV candles from 2018-01-01 to now."""
import argparse,csv,json,time,urllib.parse,urllib.request
from pathlib import Path
BASE="https://api.binance.com/api/v3/klines"
def download(symbol="BTCUSDT",interval="1d",start="2018-01-01",output="data/BTCUSDT-1d.csv"):
    start_ms=int(time.mktime(time.strptime(start,"%Y-%m-%d"))*1000)
    end_ms=int(time.time()*1000); cursor=start_ms; rows=[]
    while cursor<end_ms:
        params=urllib.parse.urlencode({"symbol":symbol,"interval":interval,"startTime":cursor,"endTime":end_ms,"limit":1000})
        req=urllib.request.Request(BASE+"?"+params,headers={"User-Agent":"TradingV2-HistoricalData/1.0"})
        with urllib.request.urlopen(req,timeout=30) as response: batch=json.loads(response.read().decode("utf-8"))
        if not batch: break
        rows.extend(batch)
        next_cursor=int(batch[-1][0])+1
        if next_cursor<=cursor: raise RuntimeError("Exchange pagination did not advance")
        cursor=next_cursor
        print(f"\rDownloaded {len(rows):,} candles",end="",flush=True)
        if len(batch)<1000: break
        time.sleep(.15)
    path=Path(output);path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",newline="",encoding="utf-8") as f:
        w=csv.writer(f);w.writerow(["open_time","close_time","open","high","low","close","volume"])
        for r in rows:
            # Binance returns millisecond timestamps and decimal strings.
            w.writerow([r[0],r[6],r[1],r[2],r[3],r[4],r[5]])
    print(f"\nSaved {len(rows):,} candles to {path}")
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--symbol",default="BTCUSDT");p.add_argument("--interval",default="1d");p.add_argument("--start",default="2018-01-01");p.add_argument("--output",default="data/BTCUSDT-1d.csv");a=p.parse_args()
    download(a.symbol,a.interval,a.start,a.output)
