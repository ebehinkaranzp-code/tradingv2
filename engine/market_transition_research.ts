/* Trading V2 Market Transition research engine.
 * Node.js + TypeScript only; no Python runtime or third-party runtime packages.
 * Signals are calculated on completed bars and filled at the next bar open.
 */
declare const require: any;
declare const module: any;
declare const process: any;
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");

export interface Bar { time:number; open:number; high:number; low:number; close:number; volume:number }
type Maybe = number | null;
type Indicators = Record<string, Maybe[]>;
const FEE=0.001, SLIPPAGE=0.0005, INITIAL=10000, OOS_START="2024-01-01";
const BASES=["https://data-api.binance.vision/api/v3/klines","https://api.binance.com/api/v3/klines"];

export const CONFIGS = [
 {id:1,name:"Ichimoku cloud breakout",cloud:1},
 {id:2,name:"Cloud + EMA200",cloud:1,ema:1},
 {id:3,name:"Cloud + Tenkan/Kijun",cloud:1,tk:1},
 {id:4,name:"Cloud + RSI recovery",cloud:1,rsiMin:50},
 {id:5,name:"Cloud + Alligator",cloud:1,alligator:1},
 {id:6,name:"Cloud + volume anomaly",cloud:1,vol:0.5},
 {id:7,name:"Cloud + strong candle",cloud:1,body:0.5},
 {id:8,name:"Cloud + EMA + RSI",cloud:1,ema:1,rsiMin:50},
 {id:9,name:"Cloud + EMA + Alligator",cloud:1,ema:1,alligator:1},
 {id:10,name:"Cloud + RSI + volume",cloud:1,rsiMin:50,vol:0.5},
 {id:11,name:"Cloud + TK + Alligator",cloud:1,tk:1,alligator:1},
 {id:12,name:"Cloud + EMA + RSI + volume",cloud:1,ema:1,rsiMin:52,vol:0.75},
 {id:13,name:"Cloud + EMA + TK + Alligator",cloud:1,ema:1,tk:1,alligator:1},
 {id:14,name:"Strict multi-confirmation",cloud:1,ema:1,tk:1,alligator:1,rsiMin:55,vol:1,body:0.6},
 {id:15,name:"Strict + breakout 20",cloud:1,ema:1,tk:1,alligator:1,rsiMin:55,vol:1,body:0.6,breakout:1},
 {id:16,name:"RSI cross above 50",rsiCross:50},
 {id:17,name:"RSI oversold recovery",rsiRecover:30},
 {id:18,name:"RSI bullish regime",rsiMin:50},
 {id:19,name:"RSI momentum + EMA50",rsiMin:52,ema50:1},
 {id:20,name:"EMA20 above EMA50",emaCross:1},
 {id:21,name:"Price above EMA200",ema200:1},
 {id:22,name:"EMA50/200 golden regime",ema:1},
 {id:23,name:"Ichimoku cloud breakout only",cloudOnly:1},
 {id:24,name:"Ichimoku bullish TK cross",tkCross:1},
 {id:25,name:"Ichimoku cloud + RSI cross",cloud:1,rsiCross:50},
 {id:26,name:"Alligator bullish alignment",alligator:1},
 {id:27,name:"Alligator expansion + volume",alligator:1,vol:0.5},
 {id:28,name:"Donchian 20 breakout",donchian:20},
 {id:29,name:"Donchian 55 breakout",donchian:55},
 {id:30,name:"Donchian 20 + RSI",donchian:20,rsiMin:50},
 {id:31,name:"Volume breakout + EMA200",vol:1,ema200:1},
 {id:32,name:"ATR-sized bullish candle",body:0.8},
 {id:33,name:"Cloud + Donchian 20",cloud:1,donchian:20},
 {id:34,name:"EMA50 + RSI + volume",ema50:1,rsiMin:52,vol:0.5},
 {id:35,name:"Multi-timeframe style trend filter",ema:1,cloud:1,rsiMin:50}
] as const;

function avg(a:number[]):number{return a.length?a.reduce((s,x)=>s+x,0)/a.length:0}
function ema(a:number[],n:number):number[]{let v:number|undefined;const k=2/(n+1);return a.map(x=>(v=v===undefined?x:k*x+(1-k)*v))}
function smma(a:number[],n:number):Maybe[]{let v:number|undefined;return a.map((x,i)=>{if(i<n-1)return null;if(i===n-1)v=avg(a.slice(0,n));else v=((v as number)*(n-1)+x)/n;return v as number})}
function rsi(a:number[],n=14):Maybe[]{const o:Maybe[]=Array(a.length).fill(null);if(a.length<=n)return o;let g=0,l=0;for(let i=1;i<=n;i++){const d=a[i]-a[i-1];g+=Math.max(0,d);l+=Math.max(0,-d)}let ag=g/n,al=l/n;const val=()=>al===0?(ag===0?50:100):100-100/(1+ag/al);o[n]=val();for(let i=n+1;i<a.length;i++){const d=a[i]-a[i-1];ag=(ag*(n-1)+Math.max(0,d))/n;al=(al*(n-1)+Math.max(0,-d))/n;o[i]=val()}return o}
function rollingMid(b:Bar[],i:number,n:number):Maybe{if(i+1<n)return null;let hi=-Infinity,lo=Infinity;for(let j=i-n+1;j<=i;j++){hi=Math.max(hi,b[j].high);lo=Math.min(lo,b[j].low)}return (hi+lo)/2}
export function weeklyBars(daily:Bar[]):Bar[]{const map=new Map<number,Bar>();for(const b of daily){const d=new Date(b.time),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);d.setUTCHours(0,0,0,0);const k=d.getTime(),old=map.get(k);if(!old)map.set(k,{time:k,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume});else{old.high=Math.max(old.high,b.high);old.low=Math.min(old.low,b.low);old.close=b.close;old.volume+=b.volume}}const monday=new Date();monday.setUTCHours(0,0,0,0);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);return [...map.values()].filter(x=>x.time<monday.getTime()).sort((a,b)=>a.time-b.time)}
export function indicators(b:Bar[]):Indicators{
 const c=b.map(x=>x.close),med=b.map(x=>(x.high+x.low)/2),ten=b.map((_,i)=>rollingMid(b,i,9)),kij=b.map((_,i)=>rollingMid(b,i,26)),sb=b.map((_,i)=>rollingMid(b,i,52));
 const a:Maybe[]=b.map((_,i)=>i<26||ten[i-26]===null||kij[i-26]===null?null:((ten[i-26] as number)+(kij[i-26] as number))/2);
 const z:Maybe[]=b.map((_,i)=>i<26?null:sb[i-26]);
 const j0=smma(med,13),t0=smma(med,8),l0=smma(med,5);
 const jaw=b.map((_,i)=>i<8?null:j0[i-8]),teeth=b.map((_,i)=>i<5?null:t0[i-5]),lips=b.map((_,i)=>i<3?null:l0[i-3]);
 const tr=b.map((x,i)=>{const p=i?c[i-1]:x.close;return Math.max(x.high-x.low,Math.abs(x.high-p),Math.abs(x.low-p))});
 const atr:Maybe[]=b.map((_,i)=>i<13?null:avg(tr.slice(i-13,i+1)));
 const volz:Maybe[]=b.map((_,i)=>{if(i<20)return null;const w=b.slice(i-20,i).map(x=>x.volume),m=avg(w),sd=Math.sqrt(avg(w.map(v=>(v-m)**2)));return (b[i].volume-m)/(sd||1)});
 return {ema20:ema(c,20),ema50:ema(c,50),ema200:ema(c,200),rsi:rsi(c),tenkan:ten,kijun:kij,spanA:a,spanB:z,jaw,teeth,lips,atr,volz};
}
export function makeSignals(b:Bar[],ind:Indicators,cfg:any):boolean[]{return b.map((x,i)=>{
 const keys=["spanA","spanB","kijun","ema200","rsi","atr","volz","jaw","teeth","lips"];
 if(keys.some(k=>ind[k][i]===null))return false;
 let ok=cfg.cloud?x.close>Math.max(ind.spanA[i] as number,ind.spanB[i] as number)&&x.close>(ind.kijun[i] as number):true;
 if(cfg.cloudOnly)ok=x.close>Math.max(ind.spanA[i] as number,ind.spanB[i] as number);
 if(cfg.ema)ok=ok&&x.close>(ind.ema200[i] as number)&&(ind.ema50[i] as number)>(ind.ema200[i] as number);
 if(cfg.ema50)ok=ok&&x.close>(ind.ema50[i] as number);
 if(cfg.ema200)ok=ok&&x.close>(ind.ema200[i] as number);
 if(cfg.emaCross)ok=ok&&i>0&&(ind.ema20[i] as number)>(ind.ema50[i] as number)&&(ind.ema20[i-1] as number)<=(ind.ema50[i-1] as number);
 if(cfg.rsiCross)ok=ok&&i>0&&(ind.rsi[i] as number)>cfg.rsiCross&&(ind.rsi[i-1] as number)<=cfg.rsiCross;
 if(cfg.rsiRecover)ok=ok&&i>0&&(ind.rsi[i] as number)>cfg.rsiRecover&&(ind.rsi[i-1] as number)<=cfg.rsiRecover;
 if(cfg.tkCross)ok=ok&&i>0&&(ind.tenkan[i] as number)>(ind.kijun[i] as number)&&(ind.tenkan[i-1] as number)<=(ind.kijun[i-1] as number);
 if(cfg.donchian){if(i<cfg.donchian)ok=false;else{let hi=-Infinity;for(let k=i-cfg.donchian;k<i;k++)hi=Math.max(hi,b[k].high);ok=ok&&x.close>hi}}
 if(cfg.tk)ok=ok&&(ind.tenkan[i] as number)>(ind.kijun[i] as number);
 if(cfg.alligator)ok=ok&&(ind.lips[i] as number)>(ind.teeth[i] as number)&&(ind.teeth[i] as number)>(ind.jaw[i] as number);
 if(cfg.rsiMin!==undefined)ok=ok&&(ind.rsi[i] as number)>=cfg.rsiMin&&(ind.rsi[i] as number)<75;
 if(cfg.vol!==undefined)ok=ok&&(ind.volz[i] as number)>=cfg.vol;
 if(cfg.body!==undefined)ok=ok&&(x.close-x.open)>=cfg.body*(ind.atr[i] as number);
 if(cfg.breakout){if(i<20)ok=false;else{let hi=-Infinity;for(let k=i-20;k<i;k++)hi=Math.max(hi,b[k].high);ok=ok&&x.close>hi}}
 return ok;
})}
export interface Trade {entryTime:number;exitTime:number;entryPrice:number;exitPrice:number;returnPct:number;pnlCash:number}
export function backtest(b:Bar[],sig:boolean[],start=0,end=b.length-1){
 if(b.length!==sig.length)throw new Error("Signal/bar length mismatch");
 end=Math.min(end,b.length-1);let cash=INITIAL,qty=0,entry:any=null,invested=0,peak=INITIAL,maxdd=0;const trades:Trade[]=[],curve:number[]=[];
 const closedEquity=()=>trades.reduce((v,t)=>v+t.pnlCash,INITIAL);
 for(let i=Math.max(0,start);i<end;i++){
  const next=b[i+1],want=sig[i];
  if(want&&qty===0){const px=next.open*(1+SLIPPAGE);entry={time:next.time,price:px,equityBefore:cash};qty=cash/(px*(1+FEE));cash=0}
  else if(!want&&qty>0){const px=next.open*(1-SLIPPAGE);cash=qty*px*(1-FEE);const pnl=cash-entry.equityBefore;trades.push({entryTime:entry.time,exitTime:next.time,entryPrice:entry.price,exitPrice:px,returnPct:pnl/entry.equityBefore*100,pnlCash:pnl});qty=0;entry=null}
  const equity=qty?qty*next.close:cash;if(qty)invested++;curve.push(equity);peak=Math.max(peak,equity);maxdd=Math.max(maxdd,peak?(peak-equity)/peak:0);
 }
 if(qty>0){const px=b[end].close*(1-SLIPPAGE);cash=qty*px*(1-FEE);const pnl=cash-entry.equityBefore;trades.push({entryTime:entry.time,exitTime:b[end].time,entryPrice:entry.price,exitPrice:px,returnPct:pnl/entry.equityBefore*100,pnlCash:pnl});if(curve.length){curve[curve.length-1]=cash;peak=Math.max(peak,cash);maxdd=Math.max(maxdd,peak?(peak-cash)/peak:0)}}
 const wins=trades.filter(t=>t.pnlCash>0).length,gains=trades.reduce((s,t)=>s+Math.max(0,t.pnlCash),0),losses=-trades.reduce((s,t)=>s+Math.min(0,t.pnlCash),0);
 return {trades:trades.length,winRatePct:trades.length?wins/trades.length*100:null,returnPct:(cash/INITIAL-1)*100,profitFactor:losses?gains/losses:(gains? "inf":null),maxDrawdownPct:maxdd*100,exposurePct:curve.length?invested/curve.length*100:0,tradeLog:trades};
}
function dateUTC(ms:number):string{return new Date(ms).toISOString().slice(0,10)}
function evaluate(b:Bar[],timeframe:string){const ind=indicators(b),split=b.findIndex(x=>dateUTC(x.time)>=OOS_START),devEnd=split>0?split-1:b.length-1;const experiments=CONFIGS.map(cfg=>{const sig=makeSignals(b,ind,cfg);const dev=backtest(b,sig,0,devEnd);const oos=split>=0&&split<b.length-1?backtest(b,sig,Math.max(0,split-1),b.length-1):backtest(b,sig,0,b.length-1);const clean=(x:any)=>{const {tradeLog,...m}=x;return m};return {experiment:cfg,development:{...clean(dev)},outOfSample2024Plus:clean(oos),oosTradeLog:oos.tradeLog}});return {timeframe,bars:b.length,firstDateUTC:dateUTC(b[0].time),lastDateUTC:dateUTC(b[b.length-1].time),oosStart:OOS_START,experiments}}
function parseCsv(s:string):Bar[]{const lines=s.trim().split(/\r?\n/);const head=lines.shift()!.split(",");const idx=(k:string)=>head.indexOf(k);const ti=idx("open_time")>=0?idx("open_time"):idx("time");const out=lines.filter(Boolean).map(line=>{const p=line.split(",");return {time:Number(p[ti]),open:Number(p[idx("open")]),high:Number(p[idx("high")]),low:Number(p[idx("low")]),close:Number(p[idx("close")]),volume:Number(p[idx("volume")])}});validateBars(out);return out}
function validateBars(b:Bar[]){if(b.length<600)throw new Error("Need >=600 daily candles, received "+b.length);for(let i=0;i<b.length;i++){const x=b[i];if(!Number.isFinite(x.time)||![x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)||Math.min(x.open,x.high,x.low,x.close)<=0||x.low>Math.min(x.open,x.close)||x.high<Math.max(x.open,x.close)||x.volume<0||(i&&x.time<=b[i-1].time))throw new Error("Invalid/unsorted OHLCV at row "+i)}}
async function downloadBinance():Promise<Bar[]>{const start=Date.UTC(2018,0,1),now=Date.now(),today=new Date();today.setUTCHours(0,0,0,0);const end=today.getTime()-1;let cursor=start;const all:any[]=[];while(cursor<end){const q=new URLSearchParams({symbol:"BTCUSDT",interval:"1d",startTime:String(cursor),endTime:String(end),limit:"1000"});let batch:any=null,lastError:any=null;for(const base of BASES){try{const r=await fetch(base+"?"+q,{headers:{"user-agent":"TradingV2-Research-Node/1.0"}});if(!r.ok)throw new Error("HTTP "+r.status);batch=await r.json();break}catch(e){lastError=e}}if(!batch)throw lastError||new Error("Binance request failed");if(!batch.length)break;all.push(...batch);const next=Number(batch[batch.length-1][0])+1;if(next<=cursor)throw new Error("Binance pagination stalled");cursor=next;console.log("Downloaded daily candles:",all.length);if(batch.length<1000)break;await new Promise(r=>setTimeout(r,120))}
 const rows:Bar[]=all.map(x=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])}));validateBars(rows);return rows}
function csvText(b:Bar[]):string{return "open_time,open,high,low,close,volume\n"+b.map(x=>[x.time,x.open,x.high,x.low,x.close,x.volume].join(",")).join("\n")+"\n"}
function mdReport(report:any):string{const lines=["# Market Transition Engine — Node.js/TypeScript — 35 experiments","","BTCUSDT Binance Spot; next-open execution; long-only; 0.10% fee + 0.05% slippage per side.","Signals use closed bars only. Daily data ends at the last completed UTC day. 2024+ is reported separately.",""];for(const tf of ["daily","weekly"]){const d=report[tf];lines.push("## "+tf.toUpperCase()+" ("+d.bars+" bars)", "", "| # | Experiment | OOS trades | Win rate | Return | PF | Max DD | Exposure |","|---:|---|---:|---:|---:|---:|---:|---:|");for(const r of d.experiments){const m=r.outOfSample2024Plus;lines.push("| "+r.experiment.id+" | "+r.experiment.name+" | "+m.trades+" | "+(m.winRatePct===null?"N/A":m.winRatePct.toFixed(2)+"%")+" | "+m.returnPct.toFixed(2)+"% | "+m.profitFactor+" | "+m.maxDrawdownPct.toFixed(2)+"% | "+m.exposurePct.toFixed(2)+"% |")}lines.push("")}lines.push("## Selection policy","","Do not optimize on win rate alone. Require a meaningful trade sample, positive out-of-sample net return, PF > 1, controlled drawdown and stability. An 85% win rate is a research target, not a guarantee.");return lines.join("\n")}
async function main(){const args=process.argv.slice(2);const arg=(name:string,def:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:def};const dataPath=arg("--data","data/BTCUSDT-1d.csv"),outPath=arg("--output","research/results/market-transition-15-node.json");let daily:Bar[];if(args.includes("--download")||!fs.existsSync(dataPath)){daily=await downloadBinance();fs.mkdirSync(path.dirname(dataPath),{recursive:true});fs.writeFileSync(dataPath,csvText(daily))}else daily=parseCsv(fs.readFileSync(dataPath,"utf8"));const weekly=weeklyBars(daily);if(weekly.length<100)throw new Error("Insufficient complete weekly bars: "+weekly.length);const report={engine:"Node.js + TypeScript",symbol:"BTCUSDT",venue:"Binance Spot",execution:"Completed-bar signal; next-bar-open fills; long-only spot; 0.10% fee and 0.05% slippage per side",antiLeakage:["Ichimoku cloud at t uses Senkou values computed at t-26.","Alligator display shifts use only historical SMMA values.","Signal at close t is filled at open t+1.","Current incomplete UTC day and week are excluded."],daily:evaluate(daily,"1d"),weekly:evaluate(weekly,"1w")};fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(report,null,2));fs.writeFileSync(outPath.replace(/\.json$/,".md"),mdReport(report));for(const tf of ["daily","weekly"]){console.log("\n"+tf.toUpperCase());for(const r of (report as any)[tf].experiments){const m=r.outOfSample2024Plus;console.log(String(r.experiment.id).padStart(2,"0"),r.experiment.name,"n="+m.trades,"win="+m.winRatePct,"return="+m.returnPct.toFixed(2)+"%","PF="+m.profitFactor,"DD="+m.maxDrawdownPct.toFixed(2)+"%")}}console.log("Wrote",outPath)}
if(require.main===module)main().catch((e:any)=>{console.error(e);process.exit(1)});
