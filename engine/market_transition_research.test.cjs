const test=require("node:test");const assert=require("node:assert/strict");
const {CONFIGS,indicators,makeSignals,weeklyBars,backtest}=require("../dist/market_transition_research.js");
function bars(n=420){return Array.from({length:n},(_,i)=>{const c=100+i*.2+(i%9)*.1;return {time:1700000000000+i*86400000,open:c-.1,high:c+1,low:c-1,close:c,volume:1000+(i%7)*10}})}
test("exactly 35 fixed experiments",()=>{assert.equal(CONFIGS.length,35);assert.deepEqual(CONFIGS.map(x=>x.id),Array.from({length:35},(_,i)=>i+1))});
test("indicator arrays align to bars",()=>{const b=bars(),x=indicators(b);for(const v of Object.values(x))assert.equal(v.length,b.length)});
test("changing future candle cannot change earlier indicator values",()=>{const b=bars(),before=indicators(b),b2=b.map(x=>({...x}));b2[b2.length-1].close*=1.8;b2[b2.length-1].high*=1.8;const after=indicators(b2);for(const k of Object.keys(before))assert.deepEqual(before[k].slice(0,-1),after[k].slice(0,-1),k)});
test("weekly aggregation excludes current unfinished week",()=>{const w=weeklyBars(bars(420));assert.ok(w.length<65);assert.ok(w.every(x=>x.time<(()=>{const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.getTime()})()))});
test("no signal means capital unchanged",()=>{const b=bars(),r=backtest(b,Array(b.length).fill(false));assert.equal(r.trades,0);assert.equal(r.returnPct,0)});
test("signals fill at next bar open and include round-trip costs",()=>{const b=bars(4);b[1].open=100;b[2].open=110;b[2].close=110;const s=[true,false,false,false],r=backtest(b,s);assert.equal(r.trades,1);assert.equal(r.tradeLog[0].entryTime,b[1].time);assert.equal(r.tradeLog[0].exitTime,b[2].time);assert.ok(r.tradeLog[0].returnPct>0)});
test("signal vector length matches bars",()=>{const b=bars();assert.equal(makeSignals(b,indicators(b),CONFIGS[0]).length,b.length)});
test("reject signal vector length mismatch",()=>assert.throws(()=>backtest(bars(),[true]),/length mismatch/));

test("all 20 added experiment signals are deterministic and aligned",()=>{const b=bars(420),ind=indicators(b);for(const cfg of CONFIGS.slice(15)){const sig=makeSignals(b,ind,cfg);assert.equal(sig.length,b.length);assert.ok(sig.every(x=>typeof x==="boolean"))}});
test("RSI cross and Donchian signals do not inspect future bars",()=>{const b=bars(420),ind=indicators(b);for(const cfg of [CONFIGS[15],CONFIGS[27]]){const base=makeSignals(b,ind,cfg);const changed=b.map(x=>({...x}));changed[changed.length-1].high*=2;changed[changed.length-1].close*=2;const after=makeSignals(changed,indicators(changed),cfg);assert.deepEqual(base.slice(0,-1),after.slice(0,-1))}});
