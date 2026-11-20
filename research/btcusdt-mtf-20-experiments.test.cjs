const test=require("node:test");
const assert=require("node:assert/strict");
const {align,wilson}=require("./btcusdt-mtf-20-experiments.cjs");
const step=900000;
const base=Array.from({length:8},(_,i)=>({time:Date.UTC(2024,0,1)+i*step}));
const higher=[{time:Date.UTC(2024,0,1)},{time:Date.UTC(2024,0,1)+3600000}];
test("1h candle is unavailable until its close; then remains the latest closed candle",()=>{
 const got=align(base,higher,null,"1h");
 assert.equal(got[0],-1);assert.equal(got[2],-1);assert.equal(got[3],0);assert.equal(got[7],1);
});
test("Wilson interval is bounded and broad for a tiny sample",()=>{
 const ci=wilson(2,2);assert.ok(ci[0]>=0&&ci[1]<=100);assert.ok(ci[0]<100&&ci[1]===100);
});
