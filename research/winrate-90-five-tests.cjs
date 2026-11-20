const fs = require("node:fs");
const { indicators, makeSignals, CONFIGS } = require("../dist/market_transition_research.js");

const FEE = 0.001, SLIPPAGE = 0.0005, INITIAL = 10000, OOS = Date.UTC(2024,0,1);
const CASES = [
  {id:"E1", name:"Donchian20 / tight target", cfg:27, tp:0.25, sl:2.0},
  {id:"E2", name:"Donchian20 / balanced target", cfg:27, tp:0.50, sl:2.0},
  {id:"E3", name:"Donchian20 + RSI / balanced", cfg:29, tp:0.50, sl:2.0},
  {id:"E4", name:"Cloud + TK + Alligator / balanced", cfg:10, tp:0.50, sl:2.0},
  {id:"E5", name:"Cloud + Donchian20 / balanced", cfg:32, tp:0.50, sl:2.0}
];
function parseCsv(s) {
  const [head,...rows]=s.trim().split(/\r?\n/), h=head.split(",");
  const ix=k=>h.indexOf(k);
  const ti=ix("open_time")>=0?ix("open_time"):ix("time");
  return rows.filter(Boolean).map(line=>{const p=line.split(",");return {time:+p[ti],open:+p[ix("open")],high:+p[ix("high")],low:+p[ix("low")],close:+p[ix("close")],volume:+p[ix("volume")]};});
}
function wilson(w,n) {
  if(!n)return null;
  const z=1.96,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return [Math.max(0,c-m)*100,Math.min(1,c+m)*100];
}
function run(b, sig, atr, spec, start) {
  let cash=INITIAL, qty=0, entry=null, peak=INITIAL, maxDD=0, wins=0, grossWin=0, grossLoss=0, exposure=0;
  const trades=[], curve=[];
  const closePosition=(rawExit, time, reason)=>{
    const fill=rawExit*(1-SLIPPAGE), proceeds=qty*fill*(1-FEE), pnl=proceeds-entry.costBasis;
    cash=proceeds; trades.push({entryTime:entry.time,exitTime:time,entryPrice:entry.price,exitPrice:fill,returnPct:pnl/entry.costBasis*100,pnl,reason});
    if(pnl>0){wins++;grossWin+=pnl}else grossLoss+=-pnl;
    qty=0;entry=null;
  };
  for(let i=start;i<b.length-1;i++){
    const bar=b[i], next=b[i+1];
    if(qty===0 && sig[i] && Number.isFinite(atr[i]) && atr[i]>0) {
      const buy=next.open*(1+SLIPPAGE), cost=buy*(1+FEE);
      qty=cash/cost; entry={time:next.time,price:buy,costBasis:cash,stop:buy-spec.sl*atr[i],target:buy+spec.tp*atr[i],bars:0};
      cash=0;
    }
    // Check the full OHLC range of the entry candle as well as every later candle.
    if(qty>0) {
      entry.bars++;
      let exit=null, reason=null;
      // Conservative same-bar ambiguity: if stop and target both trade, assume stop first.
      if(next.open<=entry.stop){exit=next.open;reason="stop_gap"}
      else if(next.open>=entry.target){exit=next.open;reason="target_gap"}
      else if(next.low<=entry.stop && next.high>=entry.target){exit=entry.stop;reason="stop_and_target_same_bar"}
      else if(next.low<=entry.stop){exit=entry.stop;reason="stop"}
      else if(next.high>=entry.target){exit=entry.target;reason="target"}
      else if(entry.bars>=60){exit=next.close;reason="time_exit"}
      if(exit!==null)closePosition(exit,next.time,reason);
    }
    const equity=qty?qty*next.close:cash;
    if(qty)exposure++;
    curve.push(equity); peak=Math.max(peak,equity); maxDD=Math.max(maxDD,(peak-equity)/peak);
  }
  if(qty>0)closePosition(b[b.length-1].close,b[b.length-1].time,"end_of_test");
  if(curve.length)curve[curve.length-1]=cash;
  const n=trades.length, losses=grossLoss;
  return {trades:n,wins,winRatePct:n?wins/n*100:null,winRateWilson95Pct:wilson(wins,n),netReturnPct:(cash/INITIAL-1)*100,profitFactor:losses?grossWin/losses:(grossWin?"inf":null),maxDrawdownPct:maxDD*100,exposurePct:curve.length?exposure/curve.length*100:0,avgTradePct:n?trades.reduce((s,t)=>s+t.returnPct,0)/n:null,avgWinPct:wins?trades.filter(t=>t.pnl>0).reduce((s,t)=>s+t.returnPct,0)/wins:null,avgLossPct:n-wins?trades.filter(t=>t.pnl<=0).reduce((s,t)=>s+t.returnPct,0)/(n-wins):null,tradeLog:trades};
}
function main() {
  const file=process.argv[2]||"data/BTCUSDT-1d.csv";
  const bars=parseCsv(fs.readFileSync(file,"utf8"));
  if(bars.length<600)throw new Error("Insufficient daily history: "+bars.length);
  const ind=indicators(bars), atr=ind.atr, split=bars.findIndex(x=>x.time>=OOS);
  if(split<1||split>=bars.length-1)throw new Error("OOS 2024+ window missing");
  const results=CASES.map(s=>{
    const signals=makeSignals(bars,ind,CONFIGS[s.cfg]);
    const r=run(bars,signals,atr,s,split-1);
    return {id:s.id,name:s.name,entryRule:CONFIGS[s.cfg],takeProfitATR:s.tp,stopLossATR:s.sl,maxHoldingBars:60,metrics:r};
  });
  const report={title:"Five win-rate experiments",symbol:"BTCUSDT",venue:"Binance Spot",timeframe:"1d",oosStart:"2024-01-01",lastDate:new Date(bars.at(-1).time).toISOString().slice(0,10),bars:bars.length,execution:"Signal on completed daily bar; entry at next open with same-entry-candle stop/target checks; 0.10% fee and 0.05% slippage per side; long-only; 60-bar time exit; conservative stop-first when stop and target touch in same bar.",caveats:["A win rate near 90% is not evidence of profitability by itself.","OHLC daily bars cannot reveal the exact intraday order when stop and target are both touched; this report assumes the adverse stop first.","The 2024+ OOS window is evaluated without retuning these five cases.","The 95% Wilson interval is shown to expose uncertainty from small samples."],results};
  fs.mkdirSync("research/results",{recursive:true});
  fs.writeFileSync("research/results/winrate-90-five-tests.json",JSON.stringify(report,null,2));
  const lines=["# Five experiments: testing the path toward 90% win rate","","BTCUSDT spot, daily bars, out-of-sample from 2024-01-01.","","| Test | Entry | TP (ATR) | SL (ATR) | Trades | Win rate | 95% Wilson CI | Net return | PF | Max DD |","|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
  for(const x of results){const m=x.metrics,ci=m.winRateWilson95Pct?m.winRateWilson95Pct.map(v=>v.toFixed(1)).join("–")+"%":"N/A";lines.push("| "+x.id+" | "+x.name+" | "+x.takeProfitATR+" | "+x.stopLossATR+" | "+m.trades+" | "+(m.winRatePct===null?"N/A":m.winRatePct.toFixed(1)+"%")+" | "+ci+" | "+m.netReturnPct.toFixed(2)+"% | "+m.profitFactor+" | "+m.maxDrawdownPct.toFixed(2)+"% |");}
  lines.push("","## Interpretation rules","","- A high win rate with negative net return or PF below 1 is a failed result, not progress.","- Tiny take-profits can raise win rate while making fees and occasional large losses dominate.","- A 90% estimate from a small number of trades is statistically weak; inspect its confidence interval and demand a large, independent sample.","- No result is a live-trading recommendation.");
  fs.writeFileSync("research/results/winrate-90-five-tests.md",lines.join("\n")+"\n");
  for(const x of results){const m=x.metrics;console.log(x.id,x.name,"n="+m.trades,"wins="+m.wins,"win="+m.winRatePct,"CI="+JSON.stringify(m.winRateWilson95Pct),"return="+m.netReturnPct.toFixed(2)+"%","PF="+m.profitFactor,"DD="+m.maxDrawdownPct.toFixed(2)+"%");}
}
if(require.main===module)main();
module.exports={CASES,parseCsv,run,wilson};
