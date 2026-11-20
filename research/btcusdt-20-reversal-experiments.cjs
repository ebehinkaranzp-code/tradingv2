const fs=require("node:fs");
const path=require("node:path");

const SYMBOL="BTCUSDT", INTERVAL="4h", START=Date.UTC(2017,7,17), OOS=Date.UTC(2024,0,1);
const FEE=0.001, SLIPPAGE=0.0005, INITIAL=10000, STOP_ATR=3.0, MAX_HOLD=90;
const BASES=["https://data-api.binance.vision/api/v3/klines","https://api.binance.com/api/v3/klines"];

function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function ema(a,n){const out=Array(a.length).fill(NaN),k=2/(n+1);let v=NaN;for(let i=0;i<a.length;i++){v=Number.isFinite(v)?k*a[i]+(1-k)*v:a[i];out[i]=v}return out}
function rolling(a,n,fn){const out=Array(a.length).fill(NaN);for(let i=n-1;i<a.length;i++)out[i]=fn(a.slice(i-n+1,i+1));return out}
function rsi(c,n=14){const out=Array(c.length).fill(NaN);if(c.length<=n)return out;let g=0,l=0;for(let i=1;i<=n;i++){const d=c[i]-c[i-1];g+=Math.max(0,d);l+=Math.max(0,-d)}let ag=g/n,al=l/n;const value=()=>al===0?(ag===0?50:100):100-100/(1+ag/al);out[n]=value();for(let i=n+1;i<c.length;i++){const d=c[i]-c[i-1];ag=(ag*(n-1)+Math.max(0,d))/n;al=(al*(n-1)+Math.max(0,-d))/n;out[i]=value()}return out}
function indicators(b){
 const c=b.map(x=>x.close),tr=b.map((x,i)=>{const p=i?c[i-1]:x.close;return Math.max(x.high-x.low,Math.abs(x.high-p),Math.abs(x.low-p))});
 const atr=rolling(tr,14,avg),r=rsi(c,14),hh=rolling(b.map(x=>x.high),14,a=>Math.max(...a)),ll=rolling(b.map(x=>x.low),14,a=>Math.min(...a));
 const k=c.map((x,i)=>Number.isFinite(hh[i])&&hh[i]!==ll[i]?(x-ll[i])/(hh[i]-ll[i])*100:NaN),d=rolling(k,3,avg);
 const wr=c.map((x,i)=>Number.isFinite(hh[i])&&hh[i]!==ll[i]?(hh[i]-x)/(hh[i]-ll[i])*-100:NaN);
 const e12=ema(c,12),e26=ema(c,26),macd=c.map((_,i)=>e12[i]-e26[i]),ms=ema(macd,9),hist=macd.map((x,i)=>x-ms[i]);
 const volz=b.map((x,i)=>{if(i<20)return NaN;const w=b.slice(i-20,i).map(y=>y.volume),m=avg(w),sd=Math.sqrt(avg(w.map(v=>(v-m)**2)));return (x.volume-m)/(sd||1)});
 return {rsi:r,k,d,wr,hist,atr,volz};
}
function parseCsv(s){const [head,...rows]=s.trim().split(/\r?\n/),h=head.split(","),ix=k=>h.indexOf(k),ti=ix("open_time")>=0?ix("open_time"):ix("time");return rows.filter(Boolean).map(line=>{const p=line.split(",");return {time:+p[ti],open:+p[ix("open")],high:+p[ix("high")],low:+p[ix("low")],close:+p[ix("close")],volume:+p[ix("volume")]}})}
function validate(b){if(b.length<1500)throw Error("Need at least 1500 four-hour candles; got "+b.length);for(let i=0;i<b.length;i++){const x=b[i];if(!Number.isFinite(x.time)||![x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)||x.low>Math.min(x.open,x.close)||x.high<Math.max(x.open,x.close)||x.volume<0||(i&&x.time<=b[i-1].time))throw Error("Invalid OHLCV row "+i)}}
async function download(){let cursor=START;const end=Date.now(),all=[];while(cursor<end){const q=new URLSearchParams({symbol:SYMBOL,interval:INTERVAL,startTime:String(cursor),endTime:String(end),limit:"1000"});let batch=null,last=null;for(const base of BASES){try{const res=await fetch(base+"?"+q,{headers:{"user-agent":"TradingV2-Reversal-Research/1.0"}});if(!res.ok)throw Error("HTTP "+res.status);batch=await res.json();break}catch(e){last=e}}if(!batch)throw last||Error("Binance download failed");if(!batch.length)break;all.push(...batch);const next=Number(batch[batch.length-1][0])+1;if(next<=cursor)throw Error("Pagination stalled");cursor=next;console.log("Fetched 4h candles:",all.length);if(batch.length<1000)break;await new Promise(r=>setTimeout(r,120))}
 const out=all.map(x=>({time:+x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]}));
 // Exclude the currently forming 4h candle.
 const now=Date.now(),step=4*60*60*1000,closed=out.filter(x=>x.time+step<=now);validate(closed);return closed}
function pivotDiv(b,osc,left,right,limit,opts={}){
 const bull=Array(b.length).fill(false),bear=Array(b.length).fill(false);let prevLow=null,prevHigh=null;
 for(let i=left+right;i<b.length;i++){
  const p=i-right,lo=b[p].low,hi=b[p].high;let isLow=true,isHigh=true;
  for(let j=p-left;j<=p+right;j++){if(j===p)continue;if(b[j].low<=lo)isLow=false;if(b[j].high>=hi)isHigh=false}
  if(isLow&&Number.isFinite(osc[p])){
   const cur={price:lo,osc:osc[p],vol:opts.vol?opts.vol[p]:NaN,index:p};
   if(prevLow&&cur.price<prevLow.price&&cur.osc>prevLow.osc&&(limit===null||cur.osc<=limit)&&(!opts.minVol||cur.vol>=opts.minVol))bull[i]=true;
   prevLow=cur;
  }
  if(isHigh&&Number.isFinite(osc[p])){
   const cur={price:hi,osc:osc[p],index:p};
   if(prevHigh&&cur.price>prevHigh.price&&cur.osc<prevHigh.osc)bear[i]=true;
   prevHigh=cur;
  }
 }
 return {bull,bear};
}
function crossUp(a,b,i){return Number.isFinite(a[i])&&Number.isFinite(a[i-1])&&Number.isFinite(b[i])&&Number.isFinite(b[i-1])&&a[i]>b[i]&&a[i-1]<=b[i-1]}
function makeExperiments(b,d){
 const out=[],add=(id,name,fn)=>out.push({id,name,signal:fn()});
 for(const t of [20,25,30,35,40])add("R"+t,"RSI "+t+" oversold recovery",()=>d.rsi.map((x,i)=>i>0&&d.rsi[i-1]<=t&&x>t));
 for(const t of [5,10,15,20,25])add("S"+t,"Stochastic K/D cross from below "+t,()=>d.k.map((x,i)=>i>0&&d.k[i-1]<=t&&crossUp(d.k,d.d,i)));
 for(const t of [-95,-90,-85,-80,-75])add("W"+Math.abs(t),"Williams %R recovery from "+t,()=>d.wr.map((x,i)=>i>0&&d.wr[i-1]<=t&&x>t));
 const r22=pivotDiv(b,d.rsi,2,2,35,{vol:d.volz}),r33=pivotDiv(b,d.rsi,3,3,40,{vol:d.volz}),r53=pivotDiv(b,d.rsi,5,3,45,{vol:d.volz}),m33=pivotDiv(b,d.hist,3,3,null),k33=pivotDiv(b,d.k,3,3,25),rvol=pivotDiv(b,d.rsi,3,3,40,{vol:d.volz,minVol:1});
 add("D16","Regular bullish RSI divergence (2L/2R, RSI pivot <=35)",()=>r22.bull);
 add("D17","Regular bullish RSI divergence (3L/3R, RSI pivot <=40)",()=>r33.bull);
 add("D18","Regular bullish RSI divergence (5L/3R, RSI pivot <=45)",()=>r53.bull);
 add("D19","Regular bullish MACD-histogram divergence (3L/3R)",()=>m33.bull);
 add("D20","RSI divergence + Stochastic confirmation + volume capitulation",()=>rvol.bull.map((v,i)=>v&&d.k[i]>d.d[i]&&d.volz[i]>=1));
 return out.map(x=>({id:x.id,name:x.name,signal:x.signal,bearExit:r33.bear}));
}
function wilson(w,n){if(!n)return null;const z=1.96,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-m)*100,Math.min(1,c+m)*100]}
function simulate(b,ind,spec,start,end){
 let cash=INITIAL,pos=null,pendingEntry=false,pendingExit=null,peak=INITIAL,maxDD=0,exposure=0,wins=0,gain=0,loss=0;const trades=[],curve=[];
 const close=(raw,time,reason)=>{const sell=raw*(1-SLIPPAGE),proceeds=pos.qty*sell*(1-FEE),pnl=proceeds-pos.cost;trades.push({entryTime:pos.time,exitTime:time,entryPrice:pos.price,exitPrice:sell,pnl,returnPct:pnl/pos.cost*100,bars:pos.bars,reason});if(pnl>0){wins++;gain+=pnl}else loss-=pnl;cash=proceeds;pos=null;pendingExit=null};
 for(let i=Math.max(1,start);i<=end;i++){
  const x=b[i];
  if(pos&&pendingExit){close(x.open,x.time,pendingExit)}
  if(!pos&&pendingEntry){const buy=x.open*(1+SLIPPAGE),cost=cash;pos={time:x.time,price:buy,qty:cost/(buy*(1+FEE)),cost,stop:buy-STOP_ATR*ind.atr[i-1],bars:0};cash=0;pendingEntry=false}
  if(pos){
   pos.bars++;
   if(x.open<=pos.stop){close(x.open,x.time,"stop_gap")}
   else if(x.low<=pos.stop){close(pos.stop,x.time,"atr_stop")}
   else if(ind.rsi[i]>=70){pendingExit="rsi_overbought"}
   else if(spec.bearExit[i]){pendingExit="confirmed_bearish_rsi_divergence"}
   else if(pos.bars>=MAX_HOLD){pendingExit="time_exit"}
  } else if(!pendingEntry&&spec.signal[i]){pendingEntry=true}
  const eq=pos?pos.qty*x.close:cash;curve.push(eq);if(pos)exposure++;peak=Math.max(peak,eq);maxDD=Math.max(maxDD,(peak-eq)/peak);
 }
 if(pos){close(b[end].close,b[end].time,"end_of_window");if(curve.length)curve[curve.length-1]=cash}
 const n=trades.length,avgRet=n?trades.reduce((s,t)=>s+t.returnPct,0)/n:null,winTrades=trades.filter(t=>t.pnl>0),loseTrades=trades.filter(t=>t.pnl<=0);
 return {trades:n,wins,winRatePct:n?wins/n*100:null,winRateWilson95Pct:wilson(wins,n),netReturnPct:(cash/INITIAL-1)*100,profitFactor:loss?gain/loss:(gain?"inf":null),maxDrawdownPct:maxDD*100,exposurePct:curve.length?exposure/curve.length*100:0,expectancyPct:avgRet,avgWinPct:winTrades.length?avg(winTrades.map(t=>t.returnPct)):null,avgLossPct:loseTrades.length?avg(loseTrades.map(t=>t.returnPct)):null,avgBarsHeld:n?avg(trades.map(t=>t.bars)):null,exitReasons:trades.reduce((o,t)=>(o[t.reason]=(o[t.reason]||0)+1,o),{}),tradeLog:trades};
}
function benchmark(b,start,end){const buy=b[start].open*(1+SLIPPAGE),qty=INITIAL/(buy*(1+FEE)),sell=b[end].close*(1-SLIPPAGE);return (qty*sell*(1-FEE)/INITIAL-1)*100}
function metricsFor(b,d,experiments,start,end){return experiments.map(s=>({id:s.id,name:s.name,metrics:simulate(b,d,s,start,end)}))}
function reportBlock(title,rows){const lines=["## "+title,"","| Test | Trades | Wins | Win rate | 95% Wilson CI | Net return | PF | Max DD | Exposure | Expectancy |","|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"];for(const x of rows){const m=x.metrics,ci=m.winRateWilson95Pct?m.winRateWilson95Pct.map(v=>v.toFixed(1)).join("–")+"%":"N/A";lines.push("| "+x.id+" "+x.name+" | "+m.trades+" | "+m.wins+" | "+(m.winRatePct===null?"N/A":m.winRatePct.toFixed(1)+"%")+" | "+ci+" | "+m.netReturnPct.toFixed(2)+"% | "+m.profitFactor+" | "+m.maxDrawdownPct.toFixed(2)+"% | "+m.exposurePct.toFixed(1)+"% | "+(m.expectancyPct===null?"N/A":m.expectancyPct.toFixed(3)+"%")+" |")}return lines}
async function main(){const args=process.argv.slice(2),arg=(k,d)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d},file=arg("--data","data/BTCUSDT-4h.csv");let b;if(args.includes("--download")||!fs.existsSync(file)){b=await download();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,"open_time,open,high,low,close,volume\n"+b.map(x=>[x.time,x.open,x.high,x.low,x.close,x.volume].join(",")).join("\n")+"\n")}else b=parseCsv(fs.readFileSync(file,"utf8"));validate(b);const d=indicators(b),experiments=makeExperiments(b,d),split=b.findIndex(x=>x.time>=OOS);if(split<500||split>=b.length-100)throw Error("Invalid OOS split: "+split+" / "+b.length);if(experiments.length!==20||new Set(experiments.map(x=>x.id)).size!==20)throw Error("Expected exactly 20 unique experiments");
 const all=metricsFor(b,d,experiments,0,b.length-1),dev=metricsFor(b,d,experiments,0,split-1),oos=metricsFor(b,d,experiments,split-1,b.length-1);
 const result={title:"BTCUSDT 20 reversal-cycle experiments",symbol:SYMBOL,venue:"Binance Spot",timeframe:INTERVAL,firstDate:new Date(b[0].time).toISOString(),lastDate:new Date(b[b.length-1].time).toISOString(),bars:b.length,oosStart:"2024-01-01",fees:{feePerSidePct:0.10,slippagePerSidePct:0.05},execution:{signal:"Only after a completed 4h candle",entry:"Next candle open",stop:"3.0 ATR from actual entry price; gap-aware",cycleExit:"RSI >=70, or confirmed regular bearish RSI divergence, or 90-bar time limit",sameBar:"OHLC stop is checked on each candle; stop takes precedence over oscillator exits",position:"Spot long-only, all available equity, one position at a time"},antiLookahead:["Regular divergence pivots use left/right confirmation; a pivot at p is only signalled at p+right bars.","Signals formed at candle close execute at the next candle open.","Bearish divergence exits are also delayed until the right-side pivot is confirmed, then exit at the next open.","The current incomplete 4h candle is excluded.","OOS starts 2024-01-01; indicator warm-up uses earlier bars but no OOS outcome is used to set rules."],benchmark:{fullHistoryPct:benchmark(b,0,b.length-1),developmentPct:benchmark(b,0,split-1),oosPct:benchmark(b,split-1,b.length-1)},results:{fullHistory:all,development:dev,outOfSample2024Plus:oos}};
 fs.mkdirSync("research/results",{recursive:true});fs.writeFileSync("research/results/btcusdt-20-reversal-experiments.json",JSON.stringify(result,null,2));
 const lines=["# BTCUSDT — 20 reversal-cycle experiments","","Binance Spot, 4h candles, "+result.firstDate.slice(0,10)+" to "+result.lastDate.slice(0,10)+".","All signals are closed-candle only; next-open fills; long-only spot; fee 0.10% + slippage 0.05% per side.","","Buy-and-hold benchmark: full "+result.benchmark.fullHistoryPct.toFixed(2)+"%; development "+result.benchmark.developmentPct.toFixed(2)+"%; OOS "+result.benchmark.oosPct.toFixed(2)+"%.","",...reportBlock("OUT OF SAMPLE — 2024-01-01 onward",oos),"",...reportBlock("DEVELOPMENT — before 2024",dev),"",...reportBlock("FULL HISTORY",all),"","## Method and safeguards","","- Entry families: RSI oversold recovery, Stochastic recovery, Williams %R recovery, and confirmed regular bullish divergence.","- All tests use the same predeclared cycle exit: RSI overbought, confirmed bearish RSI divergence, 3 ATR protective stop, or 90 bars.","- Divergence is not backdated to the pivot candle. It becomes actionable only after right-side candles confirm the pivot.","- Fees and slippage are charged on both entry and exit. Stop gaps fill at the opening price when worse than the stop.","- Win-rate confidence intervals use Wilson 95%; a high percentage with a small sample is not reliable.","- A candidate is not considered successful from win rate alone: net return, PF, drawdown, sample size, expectancy and buy-and-hold comparison all matter.","- Historical backtests are not a live-trading recommendation.","","## Experiment definitions","","| ID | Entry condition |","|---|---|"];for(const x of experiments)lines.push("| "+x.id+" | "+x.name+" |");fs.writeFileSync("research/results/btcusdt-20-reversal-experiments.md",lines.join("\n")+"\n");
 console.log("DATA",b.length,new Date(b[0].time).toISOString(),new Date(b[b.length-1].time).toISOString(),"OOS bars",b.length-split);
 for(const x of oos){const m=x.metrics;console.log(x.id,x.name,"n="+m.trades,"wins="+m.wins,"win="+m.winRatePct,"ret="+m.netReturnPct.toFixed(2)+"%","PF="+m.profitFactor,"DD="+m.maxDrawdownPct.toFixed(2)+"%","exp="+m.exposurePct.toFixed(1)+"%")}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
module.exports={indicators,pivotDiv,makeExperiments,simulate,wilson};
