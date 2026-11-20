'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('./analysis-engine.js');
function candles(n,d){const start=Date.UTC(2025,0,1);return Array.from({length:n},(_,i)=>{const base=500+d*i*.8+Math.sin(i/4)*1.2;return {openTime:start+i*3600000,closeTime:start+(i+1)*3600000-1,open:base-d*.2,high:base+1.5,low:base-1.5,close:base+d*.4,volume:100+(i%7)*3};});}
test('standalone API exports analysis functions',()=>{assert.equal(typeof engine.analyze,'function');assert.equal(typeof engine.analyzeMultiple,'function');assert.equal(engine.version,'1.0.0');});
test('rejects duplicate timestamps and malformed OHLCV',()=>{const a=candles(90,1),b=a.map(x=>({...x}));b[20].openTime=b[19].openTime;assert.throws(()=>engine.analyze(b,{interval:'1h'}),/chronological/);const c=a.map(x=>({...x}));c[10].low=c[10].high+1;assert.throws(()=>engine.analyze(c,{interval:'1h'}),/Invalid OHLCV/);});
test('excludes a still-forming last candle',()=>{const a=candles(100,1),r=engine.analyze(a,{interval:'1h',asOf:a[99].closeTime});assert.equal(r.dataQuality.closedCandles,99);assert.equal(r.candleTime,a[98].openTime);});
test('insufficient history cannot produce a signal',()=>{const r=engine.analyze(candles(40,1),{interval:'1h'});assert.equal(r.state,'INSUFFICIENT');assert.equal(r.risk,undefined);});
test('rising, falling and flat datasets return finite indicator values',()=>{for(const d of [1,-1,0]){const a=candles(260,d),r=engine.analyze(a,{interval:'1h',asOf:a[259].closeTime+1});assert.notEqual(r.state,'INSUFFICIENT');assert.ok(Number.isFinite(r.indicators.rsi));assert.ok(r.indicators.rsi>=0&&r.indicators.rsi<=100);assert.ok(Number.isFinite(r.indicators.atr));assert.equal(r.factors.length,6);}});
test('multi-timeframe analysis excludes insufficient intervals',()=>{const a=candles(240,1),r=engine.analyzeMultiple({'1h':a,'4h':candles(25,1)},{asOf:a[239].closeTime+1});assert.equal(r.evaluated,1);assert.equal(r.timeframes['4h'].state,'INSUFFICIENT');assert.ok(['BUY','SELL','WAIT'].includes(r.state));});
test('strength is a rule-agreement score, never a win probability',()=>{const a=candles(260,1),r=engine.analyze(a,{interval:'1h',asOf:a[259].closeTime+1});assert.ok(r.strength>=0&&r.strength<=100);assert.equal(Object.hasOwn(r,'winProbability'),false);});
