#!/usr/bin/env python3
"""Leakage-safe expanding-window BTC direction model and spot backtest."""
from __future__ import annotations
import argparse,csv,datetime as dt,json,math
from pathlib import Path
HORIZON=5
FEATURES=("r1","r3","r5","r10","r20","vol10","vol20","rsi14","ema20_gap","ema50_gap","ema200_gap","range20_pos","volume_z20","body_pct","atr14_pct")
def mean(x): return sum(x)/len(x) if x else 0.0
def ema(v,p):
 a=2/(p+1);o=[];z=None
 for x in v:z=x if z is None else a*x+(1-a)*z;o.append(z)
 return o
def rsi(v,p=14):
 o=[None]*len(v)
 if len(v)<=p:return o
 g=[max(0,v[i]-v[i-1]) for i in range(1,len(v))];l=[max(0,v[i-1]-v[i]) for i in range(1,len(v))]
 ag=mean(g[:p]);al=mean(l[:p])
 def val():return 50 if ag==0 and al==0 else 100 if al==0 else 100-100/(1+ag/al)
 o[p]=val()
 for i in range(p+1,len(v)):ag=(ag*(p-1)+g[i-1])/p;al=(al*(p-1)+l[i-1])/p;o[i]=val()
 return o
def read_bars(path):
 out=[]
 with open(path,newline="",encoding="utf-8") as f:
  for x in csv.DictReader(f):
   b={"time":int(x.get("open_time",x.get("time"))),"open":float(x["open"]),"high":float(x["high"]),"low":float(x["low"]),"close":float(x["close"]),"volume":float(x["volume"])}
   if min(b["open"],b["high"],b["low"],b["close"])<=0 or b["low"]>min(b["open"],b["close"]) or b["high"]<max(b["open"],b["close"]) or b["volume"]<0:raise ValueError("Invalid OHLCV")
   if out and b["time"]<=out[-1]["time"]:raise ValueError("Unsorted or duplicate candles")
   out.append(b)
 return out
def make_features(b):
 c=[x["close"] for x in b];e20=ema(c,20);e50=ema(c,50);e200=ema(c,200);rr=rsi(c);out=[None]*len(b)
 for i,x in enumerate(b):
  if i<200:continue
  ret=lambda n:c[i]/c[i-n]-1
  sd=lambda z:math.sqrt(mean([(q-mean(z))**2 for q in z]))
  win=b[i-19:i+1];hi=max(q["high"] for q in win);lo=min(q["low"] for q in win);vol=[q["volume"] for q in win];vm=mean(vol);vs=sd(vol)
  tr=[max(b[k]["high"]-b[k]["low"],abs(b[k]["high"]-c[k-1]),abs(b[k]["low"]-c[k-1])) for k in range(i-13,i+1)]
  z=[ret(1),ret(3),ret(5),ret(10),ret(20),sd([c[k]/c[k-1]-1 for k in range(i-9,i+1)]),sd([c[k]/c[k-1]-1 for k in range(i-19,i+1)]),(rr[i] or 50)-50,c[i]/e20[i]-1,c[i]/e50[i]-1,c[i]/e200[i]-1,(c[i]-lo)/(hi-lo) if hi>lo else .5,(x["volume"]-vm)/(vs or 1),(x["close"]-x["open"])/x["open"],mean(tr)/c[i]]
  if all(math.isfinite(q) for q in z):out[i]=z
 return out
def fit_logistic(x,y,epochs=500,lr=.08,l2=.02):
 n=len(x);d=len(x[0]);mu=[mean([r[j] for r in x]) for j in range(d)];sd=[math.sqrt(mean([(r[j]-mu[j])**2 for r in x])) or 1 for j in range(d)]
 z=[[(r[j]-mu[j])/sd[j] for j in range(d)] for r in x];w=[0.]*d;bias=0.
 for _ in range(epochs):
  gw=[0.]*d;gb=0.
  for row,label in zip(z,y):
   s=max(-30,min(30,bias+sum(a*q for a,q in zip(w,row))));p=1/(1+math.exp(-s));err=p-label;gb+=err
   for j in range(d):gw[j]+=err*row[j]
  bias-=lr*gb/n
  for j in range(d):w[j]-=lr*(gw[j]/n+l2*w[j])
 return {"mu":mu,"sd":sd,"w":w,"bias":bias}
def predict(m,row):
 z=[(v-a)/b for v,a,b in zip(row,m["mu"],m["sd"])];s=max(-30,min(30,m["bias"]+sum(a*q for a,q in zip(m["w"],z))));return 1/(1+math.exp(-s))
def simulate(bars,preds,fee=.001,slip=.0005,threshold=.55):
 cash=10000.;qty=0.;position=0;trades=[];curve=[];active=None;peak=cash;dd=0.
 for i in sorted(preds):
  if i+1>=len(bars):continue
  nxt=bars[i+1];want=1 if preds[i]>=threshold else 0;op=nxt["open"]
  if want!=position:
   if want:
    px=op*(1+slip);qty=cash/(px*(1+fee));cash-=qty*px*(1+fee);active={"time":nxt["time"],"price":px,"prob":preds[i]};position=1
   elif active:
    px=op*(1-slip);cash+=qty*px*(1-fee);pnl=cash-10000 if not trades else cash-(10000+sum(t["pnl"] for t in trades))
    trades.append({"entry_time":active["time"],"exit_time":nxt["time"],"entry_price":active["price"],"exit_price":px,"pnl":pnl,"entry_probability":active["prob"],"exit_probability":preds[i]});active=None;qty=0;position=0
  equity=cash if not position else qty*nxt["close"];curve.append({"time":nxt["time"],"equity":equity});peak=max(peak,equity);dd=max(dd,(peak-equity)/peak)
 if position and active:
  last=bars[max(preds)+1];px=last["close"]*(1-slip);cash=qty*px*(1-fee);pnl=cash-(10000+sum(t["pnl"] for t in trades));trades.append({"entry_time":active["time"],"exit_time":last["time"],"entry_price":active["price"],"exit_price":px,"pnl":pnl,"entry_probability":active["prob"],"exit_probability":None})
 final=cash if trades and trades[-1]["exit_time"]==bars[max(preds)+1]["time"] else (curve[-1]["equity"] if curve else 10000.)
 wins=sum(t["pnl"]>0 for t in trades);gp=sum(max(0,t["pnl"]) for t in trades);gl=-sum(min(0,t["pnl"]) for t in trades)
 return {"initial_equity":10000,"final_equity":final,"return_pct":(final/10000-1)*100,"max_drawdown_pct":dd*100,"trades":len(trades),"win_rate_pct":wins/len(trades)*100 if trades else 0,"profit_factor":gp/gl if gl else None,"trade_log":trades,"equity_curve":curve,"execution":"close signal -> next open; spot long-only; 0.1% fee and 0.05% slippage per side"}
def research(b):
 if len(b)<500:raise ValueError(f"Need >=500 daily candles; got {len(b)}")
 f=make_features(b);pred=[];annual=[]
 years=sorted({dt.datetime.fromtimestamp(x["time"]/1000,dt.timezone.utc).year for x in b})
 for year in years:
  boundary=int(dt.datetime(year,1,1,tzinfo=dt.timezone.utc).timestamp()*1000);xx=[];yy=[];test=[]
  for i,row in enumerate(f):
   if row is None or i+HORIZON>=len(b):continue
   label=int(b[i+HORIZON]["close"]>b[i]["close"])
   if b[i+HORIZON]["time"]<boundary:xx.append(row);yy.append(label)
   elif b[i]["time"]>=boundary and dt.datetime.fromtimestamp(b[i]["time"]/1000,dt.timezone.utc).year==year:test.append(i)
  if len(xx)<250 or not test:continue
  m=fit_logistic(xx,yy);yr=[]
  for i in test:
   p=predict(m,f[i]);actual=int(b[i+HORIZON]["close"]>b[i]["close"]);item={"i":i,"time":b[i]["time"],"p":p,"actual":actual,"correct":int((p>=.5)==bool(actual))};pred.append(item);yr.append(item)
  annual.append({"year":year,"train_samples":len(xx),"test_samples":len(yr),"accuracy_pct":mean([x["correct"] for x in yr])*100,"brier":mean([(x["p"]-x["actual"])**2 for x in yr])})
 if not pred:raise ValueError("No out-of-sample predictions")
 pp={x["i"]:x["p"] for x in pred};first=min(pp);last=max(pp)+HORIZON;testbars=b[first:last+1];mapped={i-first:p for i,p in pp.items()}
 bt=simulate(testbars,mapped);bh=(testbars[max(mapped)+1]["close"]/testbars[1]["open"]-1)*100
 conf={"true_up":sum(x["p"]>=.5 and x["actual"]==1 for x in pred),"false_up":sum(x["p"]>=.5 and x["actual"]==0 for x in pred),"true_down":sum(x["p"]<.5 and x["actual"]==0 for x in pred),"missed_up":sum(x["p"]<.5 and x["actual"]==1 for x in pred)}
 return {"dataset":{"symbol":"BTCUSDT","market":"Binance Spot","interval":"1d","first_utc":dt.datetime.fromtimestamp(b[0]["time"]/1000,dt.timezone.utc).isoformat(),"last_utc":dt.datetime.fromtimestamp(b[-1]["time"]/1000,dt.timezone.utc).isoformat(),"candles":len(b)},"model":"L2 logistic regression; 15 price/volatility/momentum/volume features","target":"close(t+5)>close(t)","walk_forward":"Yearly expanding training; all 5-day labels must mature before test-year start","signal_timing":"after daily close; fill next daily open","annual":annual,"classification":{"accuracy_pct":mean([x["correct"] for x in pred])*100,"brier":mean([(x["p"]-x["actual"])**2 for x in pred]),"majority_class_accuracy_pct":max(sum(x["actual"] for x in pred),len(pred)-sum(x["actual"] for x in pred))/len(pred)*100,"majority_class":"up" if sum(x["actual"] for x in pred)>=len(pred)/2 else "down","constant_base_rate_brier":(sum(x["actual"] for x in pred)/len(pred))*(1-sum(x["actual"] for x in pred)/len(pred)),"confusion":conf},"backtest":bt,"buy_hold_return_pct":bh,"limitations":["Spot long-only; no leverage, funding or borrow costs.","0.1% fee and 0.05% slippage each side; real fills can differ.","No hyperparameter tuning on test years; historical results do not prove future profit."]}
def main():
 p=argparse.ArgumentParser();p.add_argument("--data",default="data/BTCUSDT-1d.csv");p.add_argument("--output",default="research/results/btc-walk-forward.json");a=p.parse_args();r=research(read_bars(a.data));Path(a.output).parent.mkdir(parents=True,exist_ok=True);Path(a.output).write_text(json.dumps(r,indent=2,ensure_ascii=False),encoding="utf-8");print(json.dumps({k:v for k,v in r.items() if k!="backtest"},indent=2,ensure_ascii=False));print("BACKTEST",json.dumps({k:v for k,v in r["backtest"].items() if k not in ("trade_log","equity_curve")},ensure_ascii=False))
if __name__=="__main__":main()
