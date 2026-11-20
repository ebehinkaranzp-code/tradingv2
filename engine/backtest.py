#!/usr/bin/env python3
"""Causal OHLCV backtester. Strategies see only candles closed before each next-open fill."""
from __future__ import annotations
import argparse, csv, importlib.util, json, math, statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

@dataclass(frozen=True)
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

@dataclass
class Decision:
    exposure: float = 0.0       # target notional / equity, range [-1, 1]
    reason: str = "strategy"
    stop_loss: float | None = None
    take_profit: float | None = None

class Strategy(Protocol):
    name: str
    def on_bar(self, history: list[Candle]) -> Decision: ...

def load_csv(path: str | Path) -> list[Candle]:
    rows=[]
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            c=Candle(int(row.get("open_time", row.get("time"))),float(row["open"]),float(row["high"]),float(row["low"]),float(row["close"]),float(row.get("volume",0)))
            if c.open<=0 or c.close<=0 or c.low<=0 or c.high<max(c.open,c.close) or c.low>min(c.open,c.close) or c.volume<0:
                raise ValueError(f"Invalid OHLCV at {c.time}")
            if rows and c.time<=rows[-1].time: raise ValueError("CSV candles must be sorted and unique")
            rows.append(c)
    return rows

def _fill_price(price: float, delta: float, slippage: float) -> float:
    return price * (1 + math.copysign(slippage, delta)) if delta else price

def run_backtest(candles: list[Candle], strategy: Strategy, *, initial_cash=10000.0,
                 fee_rate=0.001, slippage=0.0005, start_index=0) -> dict:
    """Decision at close[i] -> market fill at open[i+1]; intrabar stop checks use prior known levels."""
    if len(candles)<3: raise ValueError("At least 3 candles are required")
    if initial_cash<=0 or fee_rate<0 or slippage<0: raise ValueError("Invalid execution settings")
    cash=float(initial_cash); qty=0.0; avg_entry=0.0; entry_fee=0.0
    episode=None; pending=None; stop=None; target=None
    trades=[]; equity_curve=[]; fills=[]; decisions=0
    peak=initial_cash; max_dd=0.0
    def equity(mark): return cash+qty*mark
    def close_position(price, time, reason):
        nonlocal cash,qty,avg_entry,entry_fee,episode,stop,target
        if abs(qty)<1e-12: return
        direction=1 if qty>0 else -1
        close_delta=-qty
        px=_fill_price(price,close_delta,slippage)
        fee=abs(close_delta*px)*fee_rate
        pnl=(px-avg_entry)*qty-fee-entry_fee
        cash += qty*px-fee
        trades.append({"entry_time":episode["entry_time"],"exit_time":time,"side":"LONG" if direction>0 else "SHORT",
          "entry_price":avg_entry,"exit_price":px,"quantity":abs(qty),"pnl":pnl,
          "return_pct":pnl/max(episode["capital"],1e-12)*100,"bars_held":episode["bars"],
          "entry_reason":episode["reason"],"exit_reason":reason,"mfe_pct":episode["mfe"],
          "mae_pct":episode["mae"],"diagnosis":("LOSS: "+reason+"; review entry filter, regime and execution" if pnl<0 else "WIN: compare setup and exit discipline")})
        fills.append({"time":time,"side":"SELL" if close_delta<0 else "BUY","price":px,"fee":fee,"reason":reason})
        qty=0.0;avg_entry=0.0;entry_fee=0.0;episode=None;stop=None;target=None
    def set_exposure(exposure, price, time, reason, new_stop, new_target):
        nonlocal cash,qty,avg_entry,entry_fee,episode,stop,target
        exposure=max(-1.0,min(1.0,float(exposure)))
        eq=max(0.0,equity(price)); desired=exposure*eq/price
        delta=desired-qty
        if abs(delta)*price < max(eq*1e-8,1e-8):
            if abs(qty)>1e-12: stop,target=new_stop,new_target
            return
        # A direction flip is closed first, then opened at the same next-bar open.
        if qty and desired and qty*desired<0: close_position(price,time,"strategy_reversal")
        if qty and (desired==0 or abs(desired)<abs(qty)):
            reduction=min(abs(qty),abs(delta))
            close_delta=-math.copysign(reduction,qty); px=_fill_price(price,close_delta,slippage)
            fee=abs(close_delta*px)*fee_rate
            realized=(px-avg_entry)*(-close_delta)-fee
            if episode: episode["partial_realized"]+=realized
            cash += close_delta*px-fee; qty+=close_delta
            fills.append({"time":time,"side":"SELL" if close_delta<0 else "BUY","price":px,"fee":fee,"reason":reason})
            if abs(qty)<1e-12:
                # close_position is bypassed for partial reductions; close the episode here.
                if episode:
                    pnl=episode["partial_realized"]-entry_fee
                    trades.append({"entry_time":episode["entry_time"],"exit_time":time,"side":episode["side"],
                      "entry_price":episode["entry_price"],"exit_price":px,"quantity":episode["quantity"],
                      "pnl":pnl,"return_pct":pnl/max(episode["capital"],1e-12)*100,"bars_held":episode["bars"],
                      "entry_reason":episode["reason"],"exit_reason":reason,"mfe_pct":episode["mfe"],"mae_pct":episode["mae"],
                      "diagnosis":("LOSS: "+reason+"; inspect signal quality and market regime" if pnl<0 else "WIN: inspect whether exit rules were repeatable")})
                episode=None;avg_entry=0;entry_fee=0;stop=None;target=None
        if desired and (qty==0 or qty*desired>0) and abs(desired)>abs(qty):
            add=desired-qty;px=_fill_price(price,add,slippage);fee=abs(add*px)*fee_rate
            old=abs(qty);new=abs(add)
            avg_entry=px if old==0 else (avg_entry*old+px*new)/(old+new)
            cash-=add*px+fee;qty+=add;entry_fee+=fee
            if episode is None:
                episode={"entry_time":time,"entry_price":px,"quantity":abs(qty),"capital":max(equity(price),1e-12),
                  "side":"LONG" if qty>0 else "SHORT","reason":reason,"bars":0,"mfe":0.0,"mae":0.0,"partial_realized":0.0}
            else: episode["quantity"]+=new
            fills.append({"time":time,"side":"BUY" if add>0 else "SELL","price":px,"fee":fee,"reason":reason})
        if abs(qty)>1e-12: stop,target=new_stop,new_target

    for i in range(max(1,start_index),len(candles)):
        bar=candles[i]
        # Execute yesterday's close decision at today's open. Future candles are not passed to strategy.
        if pending is not None:
            set_exposure(pending.exposure,bar.open,bar.time,pending.reason,pending.stop_loss,pending.take_profit)
            pending=None
        # Stops/targets were known before this candle began. If both hit, assume adverse stop first.
        if qty and stop is not None:
            hit_stop=(bar.low<=stop if qty>0 else bar.high>=stop)
            hit_target=(bar.high>=target if qty>0 else bar.low<=target) if target is not None else False
            if hit_stop: close_position(stop,bar.time,"stop_loss")
            elif hit_target: close_position(target,bar.time,"take_profit")
        if qty and episode:
            episode["bars"]+=1
            direction=1 if qty>0 else -1
            favorable=(bar.high/avg_entry-1)*direction*100 if direction>0 else (avg_entry/bar.low-1)*100
            adverse=(bar.low/avg_entry-1)*100 if direction>0 else (avg_entry/bar.high-1)*100
            episode["mfe"]=max(episode["mfe"],favorable);episode["mae"]=min(episode["mae"],adverse)
        eq=equity(bar.close);peak=max(peak,eq);max_dd=max(max_dd,(peak-eq)/peak if peak else 0)
        equity_curve.append({"time":bar.time,"equity":eq})
        # Causal contract: strategy receives a copy ending at the just-closed current candle.
        decision=strategy.on_bar(candles[:i+1])
        if not isinstance(decision,Decision): raise TypeError("Strategy.on_bar must return Decision")
        if not math.isfinite(float(decision.exposure)): raise ValueError("Strategy exposure must be finite")
        pending=decision;decisions+=1
    last=candles[-1]
    if qty: close_position(last.close,last.time,"end_of_test")
    final_equity=cash
    pnls=[t["pnl"] for t in trades];wins=[x for x in pnls if x>0];losses=[x for x in pnls if x<0]
    gross_win=sum(wins);gross_loss=abs(sum(losses))
    returns=[(equity_curve[i]["equity"]/equity_curve[i-1]["equity"]-1) for i in range(1,len(equity_curve)) if equity_curve[i-1]["equity"]>0]
    sharpe=(statistics.mean(returns)/statistics.pstdev(returns)*math.sqrt(365)) if len(returns)>2 and statistics.pstdev(returns)>0 else None
    return {"strategy":getattr(strategy,"name",strategy.__class__.__name__),"initial_cash":initial_cash,"final_equity":final_equity,
      "net_return_pct":(final_equity/initial_cash-1)*100,"max_drawdown_pct":max_dd*100,"trades":trades,
      "trade_count":len(trades),"win_rate_pct":len(wins)/len(trades)*100 if trades else 0,
      "profit_factor":gross_win/gross_loss if gross_loss else (None if not gross_win else "infinite"),
      "sharpe_daily_annualized":sharpe,"fees_and_slippage_in_fills":fills,"equity_curve":equity_curve,
      "decisions":decisions,"execution_model":"close decision -> next candle open; stop checked on candle range; stop-first if stop and target both hit"}

def load_strategy(path: str):
    spec=importlib.util.spec_from_file_location("custom_strategy",path)
    if not spec or not spec.loader: raise ValueError("Cannot load strategy file")
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    if not hasattr(mod,"Strategy"): raise ValueError("Strategy file must define class Strategy")
    return mod.Strategy()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data",required=True,help="OHLCV CSV")
    p.add_argument("--strategy",required=True,help="Python file exporting class Strategy")
    p.add_argument("--output",default="backtest-result.json")
    p.add_argument("--cash",type=float,default=10000)
    p.add_argument("--fee",type=float,default=.001)
    p.add_argument("--slippage",type=float,default=.0005)
    a=p.parse_args()
    result=run_backtest(load_csv(a.data),load_strategy(a.strategy),initial_cash=a.cash,fee_rate=a.fee,slippage=a.slippage)
    Path(a.output).write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    summary={k:v for k,v in result.items() if k not in ("trades","equity_curve","fees_and_slippage_in_fills")}
    print(json.dumps(summary,indent=2,ensure_ascii=False))
if __name__=="__main__": main()
