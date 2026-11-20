#!/usr/bin/env python3
"""Reproducible 15-pass BTCUSDT Market Transition Engine research.

All signals use closed candles only; entries/exits execute at the next candle open.
The 15 variants are pre-registered. The 2024+ period is reported separately and is
not used to tune thresholds. Standard-library only.
"""
from __future__ import annotations
import argparse, csv, datetime as dt, json, math
from pathlib import Path

FEE = 0.001
SLIPPAGE = 0.0005
INITIAL = 10_000.0
OOS_START = "2024-01-01"

def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0

def ema(xs, n):
    out=[]; a=2/(n+1); v=None
    for x in xs:
        v=x if v is None else a*x+(1-a)*v
        out.append(v)
    return out

def smma(xs, n):
    out=[]; v=None
    for i,x in enumerate(xs):
        if i < n-1: out.append(None); continue
        if i == n-1: v=mean(xs[:n])
        else: v=(v*(n-1)+x)/n
        out.append(v)
    return out

def rsi(xs, n=14):
    out=[None]*len(xs)
    if len(xs)<=n: return out
    gains=[max(0,xs[i]-xs[i-1]) for i in range(1,len(xs))]
    losses=[max(0,xs[i-1]-xs[i]) for i in range(1,len(xs))]
    ag=mean(gains[:n]); al=mean(losses[:n])
    def value():
        return 50.0 if ag==0 and al==0 else (100.0 if al==0 else 100-100/(1+ag/al))
    out[n]=value()
    for i in range(n+1,len(xs)):
        ag=(ag*(n-1)+gains[i-1])/n; al=(al*(n-1)+losses[i-1])/n
        out[i]=value()
    return out

def rolling_mid(bars, i, n):
    if i+1<n: return None
    w=bars[i-n+1:i+1]
    return (max(x["high"] for x in w)+min(x["low"] for x in w))/2

def load_csv(path):
    out=[]
    with open(path,newline="",encoding="utf-8") as f:
        for row in csv.DictReader(f):
            t=int(row.get("open_time",row.get("time")))
            b={"time":t,"open":float(row["open"]),"high":float(row["high"]),
               "low":float(row["low"]),"close":float(row["close"]),"volume":float(row["volume"])}
            if min(b["open"],b["high"],b["low"],b["close"])<=0 or b["low"]>min(b["open"],b["close"]) or b["high"]<max(b["open"],b["close"]) or b["volume"]<0:
                raise ValueError("Invalid OHLCV row")
            if out and t<=out[-1]["time"]: raise ValueError("Duplicate or unsorted timestamps")
            out.append(b)
    if len(out)<600: raise ValueError(f"Need at least 600 daily bars; got {len(out)}")
    return out

def weekly_bars(daily):
    buckets={}
    for b in daily:
        d=dt.datetime.fromtimestamp(b["time"]/1000,dt.timezone.utc).date()
        monday=d-dt.timedelta(days=d.weekday())
        key=int(dt.datetime.combine(monday,dt.time(),dt.timezone.utc).timestamp()*1000)
        if key not in buckets:
            buckets[key]={"time":key,"open":b["open"],"high":b["high"],"low":b["low"],"close":b["close"],"volume":b["volume"]}
        else:
            x=buckets[key]; x["high"]=max(x["high"],b["high"]); x["low"]=min(x["low"],b["low"]); x["close"]=b["close"]; x["volume"]+=b["volume"]
    rows=[buckets[k] for k in sorted(buckets)]
    # Exclude the current, incomplete UTC week.
    now=dt.datetime.now(dt.timezone.utc).date()
    current_monday=now-dt.timedelta(days=now.weekday())
    return [b for b in rows if dt.datetime.fromtimestamp(b["time"]/1000,dt.timezone.utc).date()<current_monday]

def indicators(b):
    c=[x["close"] for x in b]; med=[(x["high"]+x["low"])/2 for x in b]
    e20=ema(c,20); e50=ema(c,50); e200=ema(c,200); rr=rsi(c)
    ten=[rolling_mid(b,i,9) for i in range(len(b))]
    kij=[rolling_mid(b,i,26) for i in range(len(b))]
    sb=[rolling_mid(b,i,52) for i in range(len(b))]
    # Cloud visible at t is the Senkou value computed 26 bars earlier.
    span_a=[None if i<26 or ten[i-26] is None or kij[i-26] is None else (ten[i-26]+kij[i-26])/2 for i in range(len(b))]
    span_b=[None if i<26 else sb[i-26] for i in range(len(b))]
    jaw0=smma(med,13); teeth0=smma(med,8); lips0=smma(med,5)
    jaw=[jaw0[i-8] if i>=8 else None for i in range(len(b))]
    teeth=[teeth0[i-5] if i>=5 else None for i in range(len(b))]
    lips=[lips0[i-3] if i>=3 else None for i in range(len(b))]
    atr=[None]*len(b)
    trs=[]
    for i,x in enumerate(b):
        prev=c[i-1] if i else x["close"]
        trs.append(max(x["high"]-x["low"],abs(x["high"]-prev),abs(x["low"]-prev)))
    for i in range(len(b)):
        if i>=13: atr[i]=mean(trs[i-13:i+1])
    volz=[None]*len(b)
    for i in range(20,len(b)):
        w=[x["volume"] for x in b[i-20:i]]
        sd=math.sqrt(mean([(v-mean(w))**2 for v in w]))
        volz[i]=(b[i]["volume"]-mean(w))/(sd or 1)
    return {"ema20":e20,"ema50":e50,"ema200":e200,"rsi":rr,"tenkan":ten,"kijun":kij,
            "span_a":span_a,"span_b":span_b,"jaw":jaw,"teeth":teeth,"lips":lips,"atr":atr,"volz":volz}

# The 15 tests progressively add independent confirmation; these are fixed before OOS evaluation.
CONFIGS=[
 {"id":1,"name":"Ichimoku cloud breakout","cloud":1},
 {"id":2,"name":"Cloud + EMA200","cloud":1,"ema":1},
 {"id":3,"name":"Cloud + Tenkan/Kijun","cloud":1,"tk":1},
 {"id":4,"name":"Cloud + RSI recovery","cloud":1,"rsi_min":50},
 {"id":5,"name":"Cloud + Alligator","cloud":1,"alligator":1},
 {"id":6,"name":"Cloud + volume anomaly","cloud":1,"vol":0.5},
 {"id":7,"name":"Cloud + strong candle","cloud":1,"body":0.5},
 {"id":8,"name":"Cloud + EMA + RSI","cloud":1,"ema":1,"rsi_min":50},
 {"id":9,"name":"Cloud + EMA + Alligator","cloud":1,"ema":1,"alligator":1},
 {"id":10,"name":"Cloud + RSI + volume","cloud":1,"rsi_min":50,"vol":0.5},
 {"id":11,"name":"Cloud + TK + Alligator","cloud":1,"tk":1,"alligator":1},
 {"id":12,"name":"Cloud + EMA + RSI + volume","cloud":1,"ema":1,"rsi_min":52,"vol":0.75},
 {"id":13,"name":"Cloud + EMA + TK + Alligator","cloud":1,"ema":1,"tk":1,"alligator":1},
 {"id":14,"name":"Strict multi-confirmation","cloud":1,"ema":1,"tk":1,"alligator":1,"rsi_min":55,"vol":1.0,"body":0.6},
 {"id":15,"name":"Strict + breakout 20","cloud":1,"ema":1,"tk":1,"alligator":1,"rsi_min":55,"vol":1.0,"body":0.6,"breakout":1},
]

def make_signals(b, ind, cfg):
    sig=[False]*len(b)
    for i,x in enumerate(b):
        vals=[ind[k][i] for k in ("span_a","span_b","kijun","ema200","rsi","atr","volz","jaw","teeth","lips")]
        if any(v is None for v in vals): continue
        cloud_top=max(ind["span_a"][i],ind["span_b"][i])
        ok=x["close"]>cloud_top and x["close"]>ind["kijun"][i]
        if cfg.get("ema"): ok &= x["close"]>ind["ema200"][i] and ind["ema50"][i]>ind["ema200"][i]
        if cfg.get("tk"): ok &= ind["tenkan"][i]>ind["kijun"][i]
        if cfg.get("alligator"): ok &= ind["lips"][i]>ind["teeth"][i]>ind["jaw"][i]
        if cfg.get("rsi_min"): ok &= ind["rsi"][i]>=cfg["rsi_min"] and ind["rsi"][i]<75
        if cfg.get("vol") is not None: ok &= ind["volz"][i]>=cfg["vol"]
        if cfg.get("body") is not None: ok &= (x["close"]-x["open"])>=cfg["body"]*ind["atr"][i]
        if cfg.get("breakout"):
            hi=max(z["high"] for z in b[i-20:i]) if i>=20 else float("inf")
            ok &= x["close"]>hi
        sig[i]=bool(ok)
    return sig

def backtest(b, sig, start_i=0, end_i=None):
    end_i=len(b)-1 if end_i is None else min(end_i,len(b)-1)
    cash=INITIAL; qty=0.0; entry=None; trades=[]; curve=[]; invested_bars=0; peak=INITIAL; maxdd=0.0
    for i in range(max(start_i,0),end_i):
        want=sig[i]
        op=b[i+1]["open"]
        if want and qty==0:
            px=op*(1+SLIPPAGE); qty=cash/(px*(1+FEE)); cash=0.0
            entry={"time":b[i+1]["time"],"price":px,"equity_before":INITIAL if not trades else equity_from_trades(trades)}
        elif not want and qty>0:
            px=op*(1-SLIPPAGE); cash=qty*px*(1-FEE)
            pnl_cash=cash-entry["equity_before"]; pnl_pct=(cash/entry["equity_before"]-1)*100
            trades.append({"entry_time":entry["time"],"exit_time":b[i+1]["time"],"entry_price":entry["price"],"exit_price":px,"return_pct":pnl_pct,"pnl_cash":pnl_cash})
            qty=0.0; entry=None
        equity=cash if qty==0 else qty*b[i+1]["close"]
        if qty>0: invested_bars+=1
        curve.append(equity); peak=max(peak,equity); maxdd=max(maxdd,(peak-equity)/peak if peak else 0)
    if qty>0:
        px=b[end_i]["close"]*(1-SLIPPAGE); cash=qty*px*(1-FEE)
        pnl_cash=cash-entry["equity_before"]; pnl_pct=(cash/entry["equity_before"]-1)*100
        trades.append({"entry_time":entry["time"],"exit_time":b[end_i]["time"],"entry_price":entry["price"],"exit_price":px,"return_pct":pnl_pct,"pnl_cash":pnl_cash})
        if curve: curve[-1]=cash
    wins=sum(t["pnl_cash"]>0 for t in trades); gains=sum(max(0,t["pnl_cash"]) for t in trades); losses=-sum(min(0,t["pnl_cash"]) for t in trades)
    return {"trades":len(trades),"win_rate_pct":wins/len(trades)*100 if trades else None,
            "return_pct":(cash/INITIAL-1)*100,"profit_factor":gains/losses if losses else (None if not gains else "inf"),
            "max_drawdown_pct":maxdd*100,"exposure_pct":invested_bars/len(curve)*100 if curve else 0,
            "trade_log":trades}

def equity_from_trades(trades):
    eq=INITIAL
    for t in trades: eq*=1+t["return_pct"]/100
    return eq

def evaluate(b, timeframe):
    ind=indicators(b); date0=dt.datetime.fromtimestamp(b[0]["time"]/1000,dt.timezone.utc).date().isoformat()
    split=next((i for i,x in enumerate(b) if dt.datetime.fromtimestamp(x["time"]/1000,dt.timezone.utc).date().isoformat()>=OOS_START),len(b))
    results=[]
    for cfg in CONFIGS:
        sig=make_signals(b,ind,cfg)
        # Use the fixed pre-OOS segment for development diagnostics and 2024+ as untouched OOS.
        dev=backtest(b,sig,0,max(0,split-1)) if split>1 else backtest(b,sig,0)
        oos=backtest(b,sig,max(0,split-1),len(b)-1) if split<len(b)-1 else {"trades":0,"win_rate_pct":None,"return_pct":0,"profit_factor":None,"max_drawdown_pct":0,"exposure_pct":0,"trade_log":[]}
        results.append({"experiment":cfg,"development_2018_2023":{k:v for k,v in dev.items() if k!="trade_log"},
                        "out_of_sample_2024_plus":{k:v for k,v in oos.items() if k!="trade_log"},
                        "oos_trade_log":oos["trade_log"]})
    return {"timeframe":timeframe,"bars":len(b),"first_date_utc":date0,
            "last_date_utc":dt.datetime.fromtimestamp(b[-1]["time"]/1000,dt.timezone.utc).date().isoformat(),
            "oos_start":OOS_START,"experiments":results}

def main():
    p=argparse.ArgumentParser(); p.add_argument("--data",default="data/BTCUSDT-1d.csv"); p.add_argument("--output",default="research/results/market-transition-15.json")
    a=p.parse_args(); daily=load_csv(a.data)
    report={"symbol":"BTCUSDT","venue":"Binance Spot","execution":"signal at closed bar; next bar open fill; long-only spot; fee 0.10% and slippage 0.05% per side",
            "anti_leakage":["Ichimoku cloud uses Senkou values shifted back 26 bars (cloud visible at signal time).","Alligator uses only SMMA values available at each signal bar with standard forward display shifts.","All entries and exits fill at the next bar open.","2024+ is kept separate and is not used to tune the 15 fixed configurations."],
            "daily":evaluate(daily,"1d"),"weekly":evaluate(weekly_bars(daily),"1w"),
            "selection_warning":"Do not select a strategy by win rate alone. Require sufficient OOS trades, positive OOS return, PF > 1, controlled drawdown and stability. 85% win rate is a target, not a guaranteed result."}
    Path(a.output).parent.mkdir(parents=True,exist_ok=True); Path(a.output).write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
    for tf in ("daily","weekly"):
        print("\n"+tf.upper())
        for r in report[tf]["experiments"]:
            m=r["out_of_sample_2024_plus"]
            print(f'{r["experiment"]["id"]:02d} {r["experiment"]["name"]}: n={m["trades"]} win={m["win_rate_pct"]} return={m["return_pct"]:.2f}% PF={m["profit_factor"]} DD={m["max_drawdown_pct"]:.2f}%')
    print("REPORT",a.output)
if __name__=="__main__": main()
