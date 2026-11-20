const test=require("node:test");
const assert=require("node:assert/strict");
const {pivotDiv,wilson}=require("./btcusdt-20-reversal-experiments.cjs");

function bars(lows){return lows.map((low,i)=>({time:1700000000000+i*14400000,open:low+1,high:low+2,low,close:low+1,volume:100}));}
test("regular bullish divergence is emitted only after right-side pivot confirmation",()=>{
 const b=bars([10,8,10,11,12,7,10,11,12]);
 const osc=[50,20,40,45,46,30,35,40,42];
 const d=pivotDiv(b,osc,1,1,40);
 assert.equal(d.bull[5],false);
 assert.equal(d.bull[6],true);
});
test("divergence requires a lower price low and a higher oscillator low",()=>{
 const b=bars([10,8,10,11,12,9,10,11,12]);
 const osc=[50,20,40,45,46,15,25,30,32];
 const d=pivotDiv(b,osc,1,1,40);
 assert.equal(d.bull[6],false);
});
test("Wilson interval is wider for a small sample",()=>{
 const small=wilson(9,10),large=wilson(90,100);
 assert.ok(small[1]-small[0]>large[1]-large[0]);
});
