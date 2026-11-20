#!/usr/bin/env python3
import argparse,csv,datetime,json,time,urllib.parse,urllib.request
from pathlib import Path
BASES=("https://data-api.binance.vision/api/v3/klines","https://api.binance.com/api/v3/klines")
def download(symbol="BTCUSDT",interval="1d",start="2018-01-01",output="data/BTCUSDT-1d.csv"):
 cursor=int(datetime.datetime.strptime(start,"%Y-%m-%d").replace(tzinfo=datetime.timezone.utc).timestamp()*1000);end=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000);rows=[]
 while cursor<end:
  q=urllib.parse.urlencode({"symbol":symbol,"interval":interval,"startTime":cursor,"endTime":end,"limit":1000});batch=None;errors=[]
  for base in BASES:
   try:
    req=urllib.request.Request(base+"?"+q,headers={"User-Agent":"TradingV2-HistoricalResearch/1.0"})
    with urllib.request.urlopen(req,timeout=30) as r:batch=json.loads(r.read().decode())
    break
   except Exception as e:errors.append(str(e))
  if batch is None:raise RuntimeError("Binance endpoints failed: "+"; ".join(errors))
  if not batch:break
  rows.extend(batch);n=int(batch[-1][0])+1
  if n<=cursor:raise RuntimeError("Pagination stalled")
  cursor=n;print("Downloaded",len(rows),flush=True)
  if len(batch)<1000:break
  time.sleep(.15)
 if not rows:raise RuntimeError("No candles returned")
 first=datetime.datetime.fromtimestamp(rows[0][0]/1000,datetime.timezone.utc).date()
 if first>datetime.date(2018,1,2):raise RuntimeError("Dataset does not begin in 2018")
 path=Path(output);path.parent.mkdir(parents=True,exist_ok=True)
 with path.open("w",newline="",encoding="utf-8") as f:
  w=csv.writer(f);w.writerow(["open_time","close_time","open","high","low","close","volume"])
  for x in rows:w.writerow([x[0],x[6],x[1],x[2],x[3],x[4],x[5]])
 print(f"Saved {len(rows)} daily candles from {first} to {datetime.datetime.fromtimestamp(rows[-1][0]/1000,datetime.timezone.utc).date()}")
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--symbol",default="BTCUSDT");p.add_argument("--interval",default="1d");p.add_argument("--start",default="2018-01-01");p.add_argument("--output",default="data/BTCUSDT-1d.csv");a=p.parse_args();download(a.symbol,a.interval,a.start,a.output)
