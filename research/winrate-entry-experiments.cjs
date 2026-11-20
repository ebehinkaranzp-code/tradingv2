const fs=require("node:fs");
const {indicators}=require("../dist/market_transition_research.js");
const {run,wilson}=require("./winrate-90-five-tests.cjs");
const OOS=Date.UTC(2024,0,1);
function parseCsv(s){const [head,...rows]=s.trim().split(/\r?\n/),h=head.split(",");const ix=k=>h.indexOf(k),ti=ix("open_time")>=0?ix("open_time"):ix("time");return rows.filter(Boolean).map(line=>{const p=line.split(",");return {time:+p[ti],open:+p[ix("open")],high:+p[ix("high")],low:+p[ix("low")],close:+p[ix("close")],volume:+p[ix("volume")]};});}
function signalsFor(b,d){
 const out=Array.from({length:b.length},()=>Array(5).fill(false));
 for(let i=1;i<b.length;i++){
  const x=b[i],p=b[i-1],v=k=>d[k][i],pv=k=>d[k][i-1],ready=["ema20","ema50","ema200","rsi","atr","tenkan","kijun","spanA","spanB"].every(k=>Number.isFinite(v(k)));
  if(!ready||!Number.isFinite(pv("ema20"))||!(v("atr")>0))continue;
  const cloud=x.close>Math.max(v("spanA"),v("spanB"))&&x.close>v("kijun");
  // 1) Multi-confirmation trend continuation: cloud + EMA200 + RSI strength.
  out[i][0]=cloud&&x.close>v("ema200")&&v("ema50")>v("ema200")&&v("rsi")>=55&&v("rsi")<70&&v("tenkan")>v("kijun");
  // 2) Pullback reclaim: established EMA stack, prior low near EMA20, close reclaims it.
  out[i][1]=v("ema20")>v("ema50")&&v("ema50")>v("ema200")&&p.low<=pv("ema20")+0.30* v("atr")&&x.close>v("ema20")&&p.close<=pv("ema20")&&v("rsi")>=45&&v("rsi")<=68;
  // 3) Donchian breakout with long-term regime and momentum confirmation.
  let hi=-Infinity;for(let j=Math.max(0,i-20);j<i;j++)hi=Math.max(hi,b[j].high);
  out[i][2]=i>=20&&x.close>hi&&x.close>v("ema200")&&v("ema50")>v("ema200")&&v("rsi")>=52&&v("rsi")<70;
  // 4) Fresh Tenkan/Kijun bullish cross only above EMA200.
  out[i][3]=v("tenkan")>v("kijun")&&pv("tenkan")<=pv("kijun")&&x.close>v("ema200")&&v("rsi")>=50&&v("rsi")<70;
  // 5) EMA50 pullback/reclaim within a confirmed long-term uptrend.
  out[i][4]=v("ema50")>v("ema200")&&p.low<=pv("ema50")+0.50*v("atr")&&x.close>v("ema50")&&p.close<=pv("ema50")&&v("rsi")>=45&&v("rsi")<=65;
 }
 return out;
}
function main(){
 const file=process.argv[2]||"data/BTCUSDT-1d.csv",b=parseCsv(fs.readFileSync(file,"utf8"));
 if(b.length<600)throw Error("Insufficient daily history");
 const d=indicators(b),split=b.findIndex(x=>x.time>=OOS);if(split<1||split>=b.length-1)throw Error("Missing 2024+ OOS window");
 const specs=[
  {id:"N1",name:"Cloud + EMA200 + RSI strength",tp:3,sl:2},
  {id:"N2",name:"EMA stack + EMA20 pullback reclaim",tp:3,sl:2},
  {id:"N3",name:"Donchian20 breakout + EMA200 + RSI",tp:3,sl:2},
  {id:"N4",name:"Fresh TK cross + EMA200",tp:3,sl:2},
  {id:"N5",name:"EMA50 pullback reclaim + EMA200 regime",tp:3,sl:2}
 ];
 const ss=signalsFor(b,d),results=specs.map((s,k)=>{const m=run(b,ss.map(x=>x[k]),d.atr,s,split-1);return {...s,metrics:m};});
 const report={symbol:"BTCUSDT",venue:"Binance Spot",timeframe:"1d",oosStart:"2024-01-01",lastDate:new Date(b.at(-1).time).toISOString().slice(0,10),bars:b.length,execution:"Completed-bar signals; next-open entry; ATR target 3x and stop 2x; 60-bar time exit; stop-first on same-bar collision; 0.10% fee and 0.05% slippage each side; long-only.",results};
 fs.mkdirSync("research/results",{recursive:true});
 fs.writeFileSync("research/results/winrate-entry-experiments.json",JSON.stringify(report,null,2));
 const lines=["# Five new BTCUSDT entry-filter experiments","","Daily Binance Spot; out-of-sample from 2024-01-01; fixed 3 ATR target / 2 ATR stop.","","| Test | Entry filter | Trades | Wins | Win rate | 95% Wilson CI | Net return | PF | Max DD | Exposure |","|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
 for(const x of results){const m=x.metrics,ci=m.winRateWilson95Pct?m.winRateWilson95Pct.map(v=>v.toFixed(1)).join("–")+"%":"N/A";lines.push(`| ${x.id} | ${x.name} | ${m.trades} | ${m.wins} | ${m.winRatePct===null?"N/A":m.winRatePct.toFixed(1)+"%"} | ${ci} | ${m.netReturnPct.toFixed(2)}% | ${m.profitFactor} | ${m.maxDrawdownPct.toFixed(2)}% | ${m.exposurePct.toFixed(1)}% |`);}
 lines.push("","## Caveats","","- All five use identical ATR exits to isolate entry-filter effects.","- Win-rate confidence intervals are essential; small samples do not validate a 90% edge.","- A candidate is not promoted on win rate alone: require positive net return, PF > 1, acceptable drawdown and adequate independent sample size.","- Historical results are not a live-trading recommendation.");
 fs.writeFileSync("research/results/winrate-entry-experiments.md",lines.join("\n")+"\n");
 for(const x of results){const m=x.metrics;console.log(x.id,x.name,"n="+m.trades,"wins="+m.wins,"win="+m.winRatePct,"CI="+JSON.stringify(m.winRateWilson95Pct),"return="+m.netReturnPct.toFixed(2)+"%","PF="+m.profitFactor,"DD="+m.maxDrawdownPct.toFixed(2)+"%","exposure="+m.exposurePct.toFixed(1)+"%");}
}
if(require.main===module)main();
module.exports={signalsFor,parseCsv};
