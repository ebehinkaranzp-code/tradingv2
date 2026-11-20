const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const BASES=["https://data-api.binance.vision/api/v3/klines","https://api.binance.com/api/v3/klines"];
const SYMBOL="BTCUSDT",START=Date.UTC(2017,7,17),OOS=Date.UTC(2024,0,1),FEE=.001,SLIP=.0005,INITIAL=10000;
const MS={ "15m":900000,"1h":3600000,"4h":14400000,"1d":86400000 };
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
function rsi(c,n=14){const o=Array(c.length).fill(NaN);if(c.length<=n)return o;let g=0,l=0;for(let i=1;i<=n;i++){let d=c[i]-c[i-1];g+=Math.max(d,0);l+=Math.max(-d,0)}g/=n;l/=n;const v=()=>l===0?(g===0?50:100):100-100/(1+g/l);o[n]=v();for(let i=n+1;i<c.length;i++){let d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;o[i]=v()}return o}
function features(b){const c=b.map(x=>x.close),tr=b.map((x,i)=>Math.max(x.high-x.low,Math.abs(x.high-(i?c[i-1]:x.close)),Math.abs(x.low-(i?c[i-1]:x.close))));
 const atr=Array(b.length).fill(NaN);for(let i=13;i<b.length;i++)atr[i]=avg(tr.slice(i-13,i+1));
 const rr=rsi(c),k=Array(b.length).fill(NaN);for(let i=13;i<b.length;i++){let hi=-Infinity,lo=Infinity;for(let j=i-13;j<=i;j++){hi=Math.max(hi,b[j].high);lo=Math.min(lo,b[j].low)}if(hi>lo)k[i]=(c[i]-lo)/(hi-lo)*100}
 const volz=Array(b.length).fill(NaN);for(let i=20;i<b.length;i++){let a=b.slice(i-20,i).map(x=>x.volume),m=avg(a),sd=Math.sqrt(avg(a.map(x=>(x-m)**2)));volz[i]=(b[i].volume-m)/(sd||1)}
 const bull=Array(b.length).fill(false);let prev=null;for(let i=5;i<b.length;i++){let p=i-2,lo=true;for(let j=p-3;j<=p+2;j++)if(j!==p&&b[j].low<=b[p].low)lo=false;if(lo&&Number.isFinite(rr[p])){if(prev&&b[p].low<prev.price&&rr[p]>prev.rsi)bull[i]=true;prev={price:b[p].low,rsi:rr[p]}}}
 return {rsi:rr,k,atr,volz,bull};}
async function download(tf,startAt=START){let cursor=startAt,end=Date.now(),all=[];while(cursor<end){let q=new URLSearchParams({symbol:SYMBOL,interval:tf,startTime:String(cursor),endTime:String(end),limit:"1000"}),batch=null,last;
 for(const base of BASES){try{let r=await fetch(base+"?"+q,{headers:{"user-agent":"TradingV2-MTF-Research/1.0"}});if(!r.ok)throw Error("HTTP "+r.status);batch=await r.json();break}catch(e){last=e}}
 if(!batch)throw last||Error("Binance fetch failed "+tf);if(!batch.length)break;all.push(...batch);let next=Number(batch.at(-1)[0])+1;if(next<=cursor)throw Error("Pagination stalled "+tf);cursor=next;if(batch.length<1000)break;await new Promise(r=>setTimeout(r,110));if(all.length%10000===0)console.log(tf,all.length)}
 let out=all.map(x=>({time:+x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]})).filter(x=>x.time+MS[tf]<=Date.now());validate(out,tf,1);return out}
function validate(b,tf,minRows=500){if(b.length<minRows)throw Error("Insufficient "+tf+" candles: "+b.length);for(let i=0;i<b.length;i++){let x=b[i];if(!Number.isFinite(x.time)||![x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)||x.low>Math.min(x.open,x.close)||x.high<Math.max(x.open,x.close)||(i&&x.time<=b[i-1].time))throw Error("Invalid "+tf+" row "+i)}}
function writeCsv(tf,b){fs.mkdirSync("data",{recursive:true});fs.writeFileSync("data/BTCUSDT-"+tf+".csv","open_time,open,high,low,close,volume\n"+b.map(x=>[x.time,x.open,x.high,x.low,x.close,x.volume].join(",")).join("\n")+"\n")}
function readCsv(tf){let s=fs.readFileSync("data/BTCUSDT-"+tf+".csv","utf8").trim().split(/\r?\n/);return s.slice(1).map(line=>{let p=line.split(",");return {time:+p[0],open:+p[1],high:+p[2],low:+p[3],close:+p[4],volume:+p[5]}})}
// Each lower-timeframe candle receives only the latest higher-timeframe feature whose candle has already closed.
function align(base,higher,feat,tf){let out=Array(base.length).fill(-1),j=-1,dur=MS[tf];for(let i=0;i<base.length;i++){while(j+1<higher.length&&higher[j+1].time+dur<=base[i].time+MS["15m"])j++;out[i]=j}return out}
function rising(a,i,n=2){return i>=n&&Number.isFinite(a[i])&&Number.isFinite(a[i-n])&&a[i]>a[i-n]}
function cross(a,i,level){return i>0&&Number.isFinite(a[i])&&Number.isFinite(a[i-1])&&a[i]>level&&a[i-1]<=level}
function buildTests(b,f,idx){const d=f["1d"],h4=f["4h"],h1=f["1h"],m=f["15m"],tests=[];
 const filters=[
  ["D40","Daily RSI <=40",i=>d.rsi[idx["1d"][i]]<=40],
  ["D35","Daily RSI <=35",i=>d.rsi[idx["1d"][i]]<=35],
  ["DREC","Daily RSI <=50 and rising",i=>{let j=idx["1d"][i];return d.rsi[j]<=50&&rising(d.rsi,j)}],
  ["H4LOW","4H RSI <=35",i=>h4.rsi[idx["4h"][i]]<=35],
  ["D_H4","Daily RSI <=45 and 4H RSI <=40",i=>d.rsi[idx["1d"][i]]<=45&&h4.rsi[idx["4h"][i]]<=40]
 ];
 const triggers=[
  ["H1R","1H RSI recovery above 30",i=>{let j=idx["1h"][i];return j>=1&&j!==idx["1h"][i-1]&&cross(h1.rsi,j,30)}],
  ["H1DIV","Confirmed 1H bullish RSI divergence",i=>{let j=idx["1h"][i];return j>=0&&j!==idx["1h"][i-1]&&h1.bull[j]===true}],
  ["M15K","15m Stochastic recovery above 10",i=>cross(m.k,i,10)],
  ["M15R","15m RSI recovery above 25",i=>cross(m.rsi,i,25)]
 ];
 for(const [fid,fname,filterFn] of filters)for(const [tid,tname,trig] of triggers)tests.push({id:fid+"_"+tid,name:fname+" + "+tname,signal:i=>{let a=idx["1d"][i],c=idx["4h"][i],e=idx["1h"][i];return a>=30&&c>=30&&e>=30&&filterFn(i)&&trig(i)}})
 return tests}
function wilson(w,n){if(!n)return null;let z=1.96,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-m)*100,Math.min(1,c+m)*100]}
function simulate(b,m,signal,start,end){let cash=INITIAL,pos=null,pending=false,exit=null,peak=INITIAL,dd=0,wins=0,gain=0,loss=0,exposure=0,trades=[];
 const close=(raw,t,why)=>{let sell=raw*(1-SLIP),proceeds=pos.qty*sell*(1-FEE),pnl=proceeds-pos.cost;trades.push({entryTime:pos.time,exitTime:t,entryPrice:pos.price,exitPrice:sell,pnl,returnPct:pnl/pos.cost*100,bars:pos.bars,reason:why});if(pnl>0){wins++;gain+=pnl}else loss-=pnl;cash=proceeds;pos=null;exit=null};
 for(let i=Math.max(20,start);i<=end;i++){let x=b[i];if(pos&&exit)close(x.open,x.time,exit);if(!pos&&pending){let buy=x.open*(1+SLIP),cost=cash,atr=m.atr[i-1];if(Number.isFinite(atr)&&atr>0){pos={time:x.time,price:buy,qty:cost/(buy*(1+FEE)),cost,stop:buy-3*atr,bars:0};cash=0}pending=false}
 if(pos){pos.bars++;if(x.open<=pos.stop)close(x.open,x.time,"stop_gap");else if(x.low<=pos.stop)close(pos.stop,x.time,"atr_stop");else if(m.rsi[i]>=70)exit="rsi>=70";else if(pos.bars>=96)exit="96x15m_time_stop"}else if(!pending&&signal(i))pending=true;
 let eq=pos?pos.qty*x.close:cash;peak=Math.max(peak,eq);dd=Math.max(dd,(peak-eq)/peak);if(pos)exposure++}
 if(pos){close(b[end].close,b[end].time,"end_of_test")}
 let n=trades.length;return {trades:n,wins,winRatePct:n?wins/n*100:null,wilson95:wilson(wins,n),netReturnPct:(cash/INITIAL-1)*100,profitFactor:loss?gain/loss:(gain?"Infinity":null),maxDrawdownPct:dd*100,exposurePct:exposure/(end-start+1)*100,avgTradePct:n?avg(trades.map(x=>x.returnPct)):null,exitReasons:trades.reduce((o,t)=>(o[t.reason]=(o[t.reason]||0)+1,o),{}),tradeLog:trades}}
function benchmark(b,s,e){let buy=b[s].open*(1+SLIP),qty=INITIAL/(buy*(1+FEE));return (qty*b[e].close*(1-SLIP)*(1-FEE)/INITIAL-1)*100}
async function main(){fs.mkdirSync("data",{recursive:true});let data={};for(let tf of ["1d","4h","1h","15m"]){let file="data/BTCUSDT-"+tf+".csv";let b;if(fs.existsSync(file)){const cached=readCsv(tf);const delta=await download(tf,Math.max(START,cached.at(-1).time-2*MS[tf]));const byTime=new Map(cached.map(x=>[x.time,x]));for(const x of delta)byTime.set(x.time,x);b=[...byTime.values()].sort((a,z)=>a.time-z.time);validate(b,tf);if(delta.length)writeCsv(tf,b);console.log("CACHE",tf,"existing",cached.length,"refreshed",delta.length)}else{b=await download(tf);writeCsv(tf,b)}data[tf]=b;validate(b,tf);console.log("DATA",tf,b.length,new Date(b[0].time).toISOString(),new Date(b.at(-1).time).toISOString())}
 let b=data["15m"],f={};for(let tf of Object.keys(data))f[tf]=features(data[tf]);let idx={};for(let tf of ["1d","4h","1h"])idx[tf]=align(b,data[tf],f[tf],tf);
 let tests=buildTests(b,f,idx);if(tests.length!==20)throw Error("Expected 20 tests, got "+tests.length);
 let split=b.findIndex(x=>x.time>=OOS);if(split<1000||split>=b.length-100)throw Error("Bad OOS split "+split);
 const run=(s,a,z)=>simulate(b,f["15m"],s.signal,a,z);
 let results={};for(let period of ["development","outOfSample2024Plus","fullHistory"]){let a=period==="development"?0:period==="outOfSample2024Plus"?split:0,z=period==="development"?split-1:b.length-1;results[period]=tests.map(s=>({id:s.id,name:s.name,metrics:run(s,a,z)}))}
 let metadata={symbol:SYMBOL,venue:"Binance Spot",executionTimeframe:"15m",firstCandle:new Date(b[0].time).toISOString(),lastCandle:new Date(b.at(-1).time).toISOString(),bars:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),oosStart:"2024-01-01",fees:{perSidePct:.1,slippagePerSidePct:.05},rules:"Closed candles only; higher timeframe values become available only after their close; signal at 15m close, fill next 15m open; long-only spot; 3x 15m ATR stop; RSI>=70 or 96-bar time stop; one position; 0.1% fee and 0.05% slippage per side.",antiLookahead:"Higher timeframe alignment requires source open_time + interval duration <= execution candle close. Divergence is emitted only after two right-side candles confirm the pivot.",benchmark:{developmentPct:benchmark(b,0,split-1),oosPct:benchmark(b,split,b.length-1),fullHistoryPct:benchmark(b,0,b.length-1)},results};
 fs.mkdirSync("research/results",{recursive:true});fs.writeFileSync("research/results/btcusdt-mtf-20-experiments.json",JSON.stringify(metadata,null,2));
 let lines=["# BTCUSDT — 20 multi-timeframe experiments","",metadata.rules,"",metadata.antiLookahead,"","Buy & hold: development "+metadata.benchmark.developmentPct.toFixed(2)+"%; OOS "+metadata.benchmark.oosPct.toFixed(2)+"%; full "+metadata.benchmark.fullHistoryPct.toFixed(2)+"%.",""];
 for(let [period,rows] of Object.entries(results)){lines.push("## "+period,"","| Test | Trades | Win rate | Wilson 95% | Net return | PF | Max DD | Exposure |","|---|---:|---:|---:|---:|---:|---:|---:|");for(let x of rows){let m=x.metrics,ci=m.wilson95?m.wilson95.map(v=>v.toFixed(1)).join("–")+"%":"n/a";lines.push("| "+x.id+" "+x.name+" | "+m.trades+" | "+(m.winRatePct===null?"n/a":m.winRatePct.toFixed(1)+"%")+" | "+ci+" | "+m.netReturnPct.toFixed(2)+"% | "+m.profitFactor+" | "+m.maxDrawdownPct.toFixed(2)+"% | "+m.exposurePct.toFixed(1)+"% |")}lines.push("")}
 lines.push("## Definitions","");for(let x of tests)lines.push("- **"+x.id+"**: "+x.name);fs.writeFileSync("research/results/btcusdt-mtf-20-experiments.md",lines.join("\n")+"\n");
 const summary=results.outOfSample2024Plus.slice().sort((a,b)=>(b.metrics.netReturnPct-a.metrics.netReturnPct));console.log("OOS RANKING");for(let x of summary)console.log(x.id,"n="+x.metrics.trades,"win="+x.metrics.winRatePct,"net="+x.metrics.netReturnPct.toFixed(2),"PF="+x.metrics.profitFactor,"DD="+x.metrics.maxDrawdownPct.toFixed(2));
 fs.writeFileSync("data/BTCUSDT-mtf-metadata.json",JSON.stringify({symbol:SYMBOL,source:"Binance Spot public klines",downloadedAt:new Date().toISOString(),intervals:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{rows:v.length,first:new Date(v[0].time).toISOString(),last:new Date(v.at(-1).time).toISOString(),sha256:crypto.createHash("sha256").update(fs.readFileSync("data/BTCUSDT-"+k+".csv")).digest("hex")}]))},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
module.exports={align,features,wilson};
