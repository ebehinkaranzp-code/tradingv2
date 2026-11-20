// Five risk/reward experiments on the existing Ichimoku bullish TK-cross entries.
// Closed-bar signals; next-open entries; long-only spot; pessimistic stop-first intrabar tie-break.
const fs = require("node:fs");
const { indicators, makeSignals, CONFIGS, weeklyBars } = require("../dist/market_transition_research.js");
const FEE=0.001, SLIPPAGE=0.0005, INITIAL=10000;
function readCsv(file){
  const lines=fs.readFileSync(file,"utf8").trim().split(/\r?\n/), h=lines.shift().split(",");
  const ix=k=>h.indexOf(k);
  return lines.filter(Boolean).map(line=>{const p=line.split(",");return {time:+p[ix("open_time")],open:+p[ix("open")],high:+p[ix("high")],low:+p[ix("low")],close:+p[ix("close")],volume:+p[ix("volume")]};});
}
function simulate(bars,signals,start,end,tpPct,slPct){
  let cash=INITIAL,qty=0,entry=null,peak=INITIAL,maxDD=0,exposure=0;const trades=[],curve=[];
  function closeAt(raw,time){
    const px=raw*(1-SLIPPAGE), proceeds=qty*px*(1-FEE), pnl=proceeds-entry.equity;
    trades.push({entryTime:entry.time,exitTime:time,entryPrice:entry.price,exitPrice:px,pnlCash:pnl,returnPct:pnl/entry.equity*100});
    cash=proceeds;qty=0;entry=null;
  }
  for(let i=Math.max(0,start);i<Math.min(end,bars.length-1);i++){
    const bar=bars[i+1],want=signals[i];
    if(qty===0&&want){
      const px=bar.open*(1+SLIPPAGE);entry={time:bar.time,price:px,equity:cash};qty=cash/(px*(1+FEE));cash=0;
      // Entry candle is included; if both barriers print, assume the stop was hit first.
      const stop=entry.price*(1-slPct/100),target=entry.price*(1+tpPct/100);
      const hs=bar.low<=stop,ht=bar.high>=target;
      if(hs||ht)closeAt(hs?Math.min(bar.open,stop):Math.max(bar.open,target),bar.time);
    } else if(qty>0){
      if(!want){closeAt(bar.open,bar.time);}
      else{
        const stop=entry.price*(1-slPct/100),target=entry.price*(1+tpPct/100);
        const hs=bar.low<=stop,ht=bar.high>=target;
        if(hs||ht)closeAt(hs?Math.min(bar.open,stop):Math.max(bar.open,target),bar.time);
      }
    }
    const eq=qty?qty*bar.close:cash;if(qty)exposure++;curve.push(eq);peak=Math.max(peak,eq);maxDD=Math.max(maxDD,(peak-eq)/peak);
  }
  if(qty>0)closeAt(bars[Math.min(end,bars.length-1)].close,bars[Math.min(end,bars.length-1)].time);
  const wins=trades.filter(t=>t.pnlCash>0).length,gains=trades.reduce((a,t)=>a+Math.max(0,t.pnlCash),0),losses=-trades.reduce((a,t)=>a+Math.min(0,t.pnlCash),0);
  return {trades:trades.length,wins,winRatePct:trades.length?100*wins/trades.length:null,returnPct:100*(cash/INITIAL-1),profitFactor:losses?gains/losses:(gains?"inf":null),maxDrawdownPct:100*maxDD,exposurePct:curve.length?100*exposure/curve.length:0,tradeLog:trades};
}
function run(bars,timeframe){
  const ind=indicators(bars),signals=makeSignals(bars,ind,CONFIGS[23]),split=bars.findIndex(x=>new Date(x.time).toISOString().slice(0,10)>="2024-01-01"),start=split>0?split-1:0,end=bars.length-1;
  const profiles=[{id:"TP1_SL2",tp:1,sl:2},{id:"TP2_SL2",tp:2,sl:2},{id:"TP3_SL2",tp:3,sl:2},{id:"TP4_SL2",tp:4,sl:2},{id:"TP6_SL2",tp:6,sl:2}];
  return {timeframe,bars:bars.length,firstDate:new Date(bars[0].time).toISOString().slice(0,10),lastDate:new Date(bars[end].time).toISOString().slice(0,10),oosStart:"2024-01-01",baseEntry:"Ichimoku bullish TK cross (experiment 24)",profiles:profiles.map(p=>({id:p.id,takeProfitPct:p.tp,stopLossPct:p.sl,development:simulate(bars,signals,0,Math.max(0,split-1),p.tp,p.sl),outOfSample2024Plus:simulate(bars,signals,start,end,p.tp,p.sl)}))};
}
const daily=readCsv("data/BTCUSDT-1d.csv"),weekly=weeklyBars(daily);
const report={symbol:"BTCUSDT",venue:"Binance Spot",execution:"Closed-bar signal, next-open entry, TP/SL checked against OHLC; stop-first if both touched; 0.10% fee and 0.05% slippage per side",note:"Five exit profiles applied to the same fixed entry signal; do not treat the profiles as five independent strategies.",daily:run(daily,"daily"),weekly:run(weekly,"weekly")};
fs.mkdirSync("research/results",{recursive:true});
fs.writeFileSync("research/results/win-rate-five-experiments.json",JSON.stringify(report,null,2));
for(const tf of ["daily","weekly"]){console.log("\\n"+tf.toUpperCase());for(const p of report[tf].profiles){const m=p.outOfSample2024Plus;console.log(p.id,"trades="+m.trades,"win="+m.winRatePct,"return="+m.returnPct.toFixed(2)+"%","PF="+m.profitFactor,"DD="+m.maxDrawdownPct.toFixed(2)+"%","exposure="+m.exposurePct.toFixed(2)+"%");}}
