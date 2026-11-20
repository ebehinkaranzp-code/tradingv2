#!/usr/bin/env python3
"""Build candle-aligned Binance footprint features from historical aggTrades CSV."""
from __future__ import annotations
import argparse,csv,json,math
from pathlib import Path
FEATURE_NAMES=("fp_available","fp_delta_ratio","fp_buy_share","fp_log_total_volume","fp_log_trade_count","fp_imbalance_5","fp_cvd_20","fp_absorption_up","fp_absorption_down")
def _bool(v):
 s=str(v).strip().lower()
 if s in ("true","1","t"):return True
 if s in ("false","0","f"):return False
 raise ValueError("Invalid is_buyer_maker value: "+str(v))
def load_candles(path):
 out=[]
 with open(path,newline="",encoding="utf-8") as f:
  for r in csv.DictReader(f):
   t=int(r.get("open_time",r.get("time")))
   out.append({"time":t,"open":float(r["open"]),"high":float(r["high"]),"low":float(r["low"]),"close":float(r["close"])})
 if any(out[i]["time"]>=out[i+1]["time"] for i in range(len(out)-1)):raise ValueError("Candles must be strictly chronological")
 return out
def aggregate(candles,trades_path,interval_ms=86400000):
 if interval_ms<=0:raise ValueError("interval_ms must be positive")
 starts=[c["time"] for c in candles]
 buckets=[{"buy":0.,"sell":0.,"count":0} for _ in candles]
 idx=0;last_time=-1
 with open(trades_path,newline="",encoding="utf-8") as f:
  reader=csv.DictReader(f)
  if not reader.fieldnames or not {"price","quantity","is_buyer_maker"}.issubset(set(reader.fieldnames)):raise ValueError("aggTrades CSV needs price, quantity and is_buyer_maker headers")
  time_key=next((x for x in ("transact_time","timestamp","time") if x in reader.fieldnames),None)
  if not time_key:raise ValueError("aggTrades CSV needs transact_time timestamp column")
  for row in reader:
   ts=int(row[time_key])
   if ts<last_time:raise ValueError("aggTrades must be chronological")
   last_time=ts
   while idx+1<len(starts) and ts>=starts[idx]+interval_ms:idx+=1
   if idx>=len(starts) or ts<starts[idx] or ts>=starts[idx]+interval_ms:continue
   price=float(row["price"]);qty=float(row["quantity"])
   if price<=0 or qty<0 or not math.isfinite(price*qty):raise ValueError("Invalid trade price/quantity")
   b=buckets[idx]
   if _bool(row["is_buyer_maker"]):b["sell"]+=qty
   else:b["buy"]+=qty
   b["count"]+=1
 out=[];deltas=[]
 for i,(c,b) in enumerate(zip(candles,buckets)):
  total=b["buy"]+b["sell"];available=b["count"]>0
  delta=(b["buy"]-b["sell"])/total if total else 0.;deltas.append(delta)
  imbalance=sum(deltas[-5:])/len(deltas[-5:])
  cvd=sum(x["buy"]-x["sell"] for x in buckets[max(0,i-19):i+1])
  body=(c["close"]-c["open"])/c["open"]
  buy_abs=int(available and b["buy"]>b["sell"] and abs(body)<.002 and total>0)
  sell_abs=int(available and b["sell"]>b["buy"] and abs(body)<.002 and total>0)
  features=[float(available),delta,b["buy"]/total if total else 0.,math.log1p(total),math.log1p(b["count"]),imbalance,cvd,float(buy_abs),float(sell_abs)]
  out.append({"time":c["time"],"buy_volume":b["buy"],"sell_volume":b["sell"],"delta":b["buy"]-b["sell"],"delta_ratio":delta,"trade_count":b["count"],"features":features,"available":available})
 return out
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument("--candles",required=True);p.add_argument("--trades",required=True);p.add_argument("--output",default="research/results/btc-footprint-features.json");p.add_argument("--interval-ms",type=int,default=86400000);a=p.parse_args()
 candles=load_candles(a.candles);rows=aggregate(candles,a.trades,a.interval_ms)
 result={"feature_names":FEATURE_NAMES,"candles":len(rows),"covered_candles":sum(x["available"] for x in rows),"coverage_pct":100*sum(x["available"] for x in rows)/len(rows) if rows else 0,"source":"Binance aggTrades; buyer-maker flag determines aggressor side","rows":rows}
 path=Path(a.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
 print(json.dumps({k:v for k,v in result.items() if k!="rows"},indent=2))
if __name__=="__main__":main()
