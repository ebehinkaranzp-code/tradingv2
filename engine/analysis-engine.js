'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TradingV2AnalysisEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const INTERVAL_MS = {'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'2h':7200000,'4h':14400000,'6h':21600000,'8h':28800000,'12h':43200000,'1d':86400000,'3d':259200000,'1w':604800000};
  const num = v => v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null);

  function normalizeCandles(rows, options) {
    const o=options||{}, duration=INTERVAL_MS[o.interval];
    if(!Array.isArray(rows)) throw new TypeError('candles must be an array');
    const out=rows.map((r,i)=>{
      if(!r||typeof r!=='object') throw new Error('Invalid candle at index '+i);
      const time=num(r.openTime??r.open_time??r.time), open=num(r.open), high=num(r.high), low=num(r.low), close=num(r.close), volume=num(r.volume??r.vol??0);
      let closeTime=num(r.closeTime??r.close_time);
      if(closeTime===null&&time!==null&&duration) closeTime=time+duration-1;
      if([time,open,high,low,close,volume,closeTime].some(x=>x===null)||time<0||closeTime<time||open<=0||high<=0||low<=0||close<=0||volume<0||low>Math.min(open,close)||high<Math.max(open,close)||low>high) throw new Error('Invalid OHLCV candle at index '+i);
      return {time,closeTime,open,high,low,close,volume};
    });
    for(let i=1;i<out.length;i++) if(out[i].time<=out[i-1].time) throw new Error('Candles must be strictly chronological without duplicates');
    const asOf=num(o.asOf)??Date.now();
    return out.filter(c=>c.closeTime<asOf);
  }
  function sma(v,p){const out=Array(v.length).fill(null);if(!Number.isInteger(p)||p<1)throw new RangeError('period must be positive');for(let i=p-1;i<v.length;i++){let s=0,ok=true;for(let j=i-p+1;j<=i;j++){if(!Number.isFinite(v[j])){ok=false;break;}s+=v[j];}if(ok)out[i]=s/p;}return out;}
  function ema(v,p){const out=Array(v.length).fill(null),a=2/(p+1);let prev=null;for(let i=0;i<v.length;i++){const x=num(v[i]);if(x===null)continue;prev=prev===null?x:a*x+(1-a)*prev;out[i]=prev;}return out;}
  function rsi(v,p=14){const out=Array(v.length).fill(null);if(v.length<=p)return out;let g=0,l=0;for(let i=1;i<=p;i++){const d=v[i]-v[i-1];g+=Math.max(0,d);l+=Math.max(0,-d);}let ag=g/p,al=l/p;const value=()=>al===0?(ag===0?50:100):100-100/(1+ag/al);out[p]=value();for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];ag=(ag*(p-1)+Math.max(0,d))/p;al=(al*(p-1)+Math.max(0,-d))/p;out[i]=value();}return out;}
  function stochastic(rows,p=14,sk=3,sd=3){const raw=Array(rows.length).fill(null);for(let i=p-1;i<rows.length;i++){let hi=-Infinity,lo=Infinity;for(let j=i-p+1;j<=i;j++){hi=Math.max(hi,rows[j].high);lo=Math.min(lo,rows[j].low);}raw[i]=hi===lo?50:100*(rows[i].close-lo)/(hi-lo);}const k=sma(raw,sk);return {k,d:sma(k,sd)};}
  function smma(v,p){const out=Array(v.length).fill(null);if(v.length<p)return out;let seed=0;for(let i=0;i<p;i++)seed+=v[i];let prev=seed/p;out[p-1]=prev;for(let i=p;i<v.length;i++){prev=(prev*(p-1)+v[i])/p;out[i]=prev;}return out;}
  function atr(rows,p=14){const out=Array(rows.length).fill(null);let pc=null,pa=null;for(let i=0;i<rows.length;i++){const c=rows[i],tr=pc===null?c.high-c.low:Math.max(c.high-c.low,Math.abs(c.high-pc),Math.abs(c.low-pc));pa=pa===null?tr:((p-1)*pa+tr)/p;out[i]=pa;pc=c.close;}return out;}
  function macd(v){const f=ema(v,12),s=ema(v,26),line=v.map((_,i)=>f[i]===null||s[i]===null?null:f[i]-s[i]),signal=ema(line,9);return {line,signal,histogram:line.map((x,i)=>x===null||signal[i]===null?null:x-signal[i])};}

  function analyze(rows, options) {
    const c=Object.assign({interval:null,asOf:Date.now(),minCandles:80,rsiPeriod:14,stochasticPeriod:14,smoothK:3,smoothD:3,jawPeriod:13,teethPeriod:8,lipsPeriod:5,jawShift:8,teethShift:5,lipsShift:3,atrPeriod:14,stopAtr:1.5,targetAtr:3},options||{});
    const bars=normalizeCandles(rows,c);
    if(bars.length<c.minCandles)return {state:'INSUFFICIENT',direction:'NEUTRAL',strength:0,count:bars.length,required:c.minCandles,reasons:['حداقل '+c.minCandles+' کندل بسته‌شده لازم است.'],dataQuality:{valid:true,closedCandles:bars.length,gaps:null}};
    const close=bars.map(x=>x.close),mid=bars.map(x=>(x.high+x.low)/2),rv=rsi(close,c.rsiPeriod),st=stochastic(bars,c.stochasticPeriod,c.smoothK,c.smoothD),jaw=smma(mid,c.jawPeriod),teeth=smma(mid,c.teethPeriod),lips=smma(mid,c.lipsPeriod),e20=ema(close,20),e50=ema(close,50),e200=ema(close,200),mc=macd(close),av=atr(bars,c.atrPeriod);
    const i=bars.length-1,p=i-1,j=jaw[i-c.jawShift],t=teeth[i-c.teethShift],l=lips[i-c.lipsShift],jp=jaw[i-c.jawShift-1],tp=teeth[i-c.teethShift-1],lp=lips[i-c.lipsShift-1];
    if([rv[i],rv[p],st.k[i],st.k[p],st.d[i],st.d[p],j,t,l,jp,tp,lp,e20[i],e50[i],mc.histogram[i],av[i]].some(x=>!Number.isFinite(x)))return {state:'INSUFFICIENT',direction:'NEUTRAL',strength:0,count:bars.length,required:c.minCandles,reasons:['تاریخچه برای تکمیل اندیکاتورها کافی نیست.'],dataQuality:{valid:true,closedCandles:bars.length,gaps:null}};
    const factors=[],add=(name,score,detail)=>factors.push({name,score,detail});
    const ru=rv[i]>50&&rv[i]>rv[p],rd=rv[i]<50&&rv[i]<rv[p];add('RSI',ru?1:rd?-1:0,'RSI '+rv[i].toFixed(1)+(ru?'؛ مومنتوم صعودی':rd?'؛ مومنتوم نزولی':'؛ خنثی'));
    const su=st.k[i]>st.d[i]&&(st.k[p]<=st.d[p]||st.k[i]<50),sd=st.k[i]<st.d[i]&&(st.k[p]>=st.d[p]||st.k[i]>50);add('Stochastic',su?1:sd?-1:0,'K/D '+st.k[i].toFixed(1)+' / '+st.d[i].toFixed(1));
    const au=l>t&&t>j&&close[i]>l&&l>lp&&t>tp&&j>jp,ad=l<t&&t<j&&close[i]<l&&l<lp&&t<tp&&j<jp;add('Williams Alligator',au?2:ad?-2:0,au?'چیدمان و شیب خطوط صعودی':ad?'چیدمان و شیب خطوط نزولی':'خطوط هم‌جهت و بازشده نیستند');
    const tu=close[i]>e50[i]&&e50[i]>e50[Math.max(0,i-5)]&&(e200[i]===null||close[i]>e200[i]),td=close[i]<e50[i]&&e50[i]<e50[Math.max(0,i-5)]&&(e200[i]===null||close[i]<e200[i]);add('EMA trend',tu?2:td?-2:0,'قیمت '+(close[i]>=e50[i]?'بالای':'پایین')+' EMA50');
    const mu=mc.histogram[i]>0&&mc.histogram[i]>mc.histogram[p],md=mc.histogram[i]<0&&mc.histogram[i]<mc.histogram[p];add('MACD',mu?1:md?-1:0,'Histogram '+mc.histogram[i].toPrecision(5));
    const prior=bars.slice(Math.max(0,i-20),i),avg=prior.reduce((s,x)=>s+x.volume,0)/Math.max(1,prior.length),vol=avg>0&&bars[i].volume>=avg*1.2,vd=(au||tu)?1:(ad||td)?-1:0;add('Volume',vol?vd:0,vol?'حجم کندل آخر حداقل ۱٫۲ برابر میانگین ۲۰ کندل قبلی است':'افزایش حجم تأیید نشده');
    const score=factors.reduce((s,x)=>s+x.score,0),state=score>=3?'BUY':score<=-3?'SELL':'WAIT',direction=state==='BUY'?'BULLISH':state==='SELL'?'BEARISH':'NEUTRAL',strength=Math.round(Math.min(100,Math.abs(score)/8*100)),a=av[i];
    const risk=state==='BUY'?{stop:close[i]-a*c.stopAtr,target1:close[i]+a,target2:close[i]+a*c.targetAtr}:state==='SELL'?{stop:close[i]+a*c.stopAtr,target1:close[i]-a,target2:close[i]-a*c.targetAtr}:null;
    let gaps=0;if(c.interval&&INTERVAL_MS[c.interval])for(let k=1;k<bars.length;k++)if(bars[k].time-bars[k-1].time>INTERVAL_MS[c.interval]*1.5)gaps++;
    return {state,direction,score,maxScore:8,strength,symbol:c.symbol||null,interval:c.interval,price:close[i],candleTime:bars[i].time,candleCloseTime:bars[i].closeTime,indicators:{rsi:rv[i],stochasticK:st.k[i],stochasticD:st.d[i],alligator:{jaw:j,teeth:t,lips:l},ema20:e20[i],ema50:e50[i],ema200:e200[i],macd:{line:mc.line[i],signal:mc.signal[i],histogram:mc.histogram[i]},atr:a,atrPercent:a/close[i]*100},factors,reasons:factors.filter(x=>x.score!==0).map(x=>x.detail),risk,dataQuality:{valid:true,closedCandles:bars.length,gaps,lastClosedCandle:bars[i].closeTime}};
  }
  function analyzeMultiple(timeframes,options){if(!timeframes||typeof timeframes!=='object'||Array.isArray(timeframes))throw new TypeError('timeframes must be an object keyed by interval');const weights=Object.assign({'15m':0.5,'1h':1,'4h':1.5,'1d':2,'1w':2.5},options&&options.timeframeWeights||{}),results={};let total=0,weight=0;for(const tf of Object.keys(timeframes)){const r=analyze(timeframes[tf],Object.assign({},options||{},{interval:tf}));results[tf]=r;if(r.state!=='INSUFFICIENT'){const w=num(weights[tf])||1;total+=r.score*w;weight+=w;}}if(!weight)return {state:'INSUFFICIENT',direction:'NEUTRAL',strength:0,timeframes:results,reasons:['برای هیچ تایم‌فریمی داده کافی وجود ندارد.']};const score=total/weight,state=score>=3?'BUY':score<=-3?'SELL':'WAIT';return {state,direction:state==='BUY'?'BULLISH':state==='SELL'?'BEARISH':'NEUTRAL',score:Number(score.toFixed(2)),strength:Math.round(Math.min(100,Math.abs(score)/8*100)),timeframes:results,aligned:Object.values(results).filter(r=>r.state===state&&state!=='WAIT').length,evaluated:Object.values(results).filter(r=>r.state!=='INSUFFICIENT').length,reasons:['تجمیع وزن‌دار تایم‌فریم‌های دارای داده معتبر؛ این امتیاز احتمال برد نیست.']};}
  return {version:'1.0.0',analyze,analyzeMultiple,normalizeCandles,indicators:{sma,ema,rsi,stochastic,smma,atr,macd},intervals:Object.keys(INTERVAL_MS)};
});
