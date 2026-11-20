const test=require("node:test");
const assert=require("node:assert/strict");
const {CASES,run,wilson}=require("./winrate-90-five-tests.cjs");
function bars(n=6){return Array.from({length:n},(_,i)=>({time:1700000000000+i*86400000,open:100,high:101,low:99,close:100,volume:1000}));}
test("exactly five distinct, predeclared experiments",()=>{assert.equal(CASES.length,5);assert.equal(new Set(CASES.map(x=>x.id)).size,5);});
test("no entry signals leave capital unchanged",()=>{const b=bars(),r=run(b,Array(b.length).fill(false),Array(b.length).fill(1),CASES[0],0);assert.equal(r.trades,0);assert.equal(r.netReturnPct,0);});
test("same-bar stop and target collision is resolved conservatively as a stop",()=>{const b=bars();b[1].high=100.2;b[1].low=99.8;b[2].high=102;b[2].low=97;const s=[true,false,false,false,false,false],a=Array(b.length).fill(1);const r=run(b,s,a,CASES[1],0);assert.equal(r.trades,1);assert.equal(r.tradeLog[0].reason,"stop_and_target_same_bar");assert.equal(r.wins,0);});
test("win-rate confidence interval widens for small samples",()=>{const small=wilson(9,10),large=wilson(90,100);assert.ok(small[1]-small[0]>large[1]-large[0]);assert.ok(small[0]<90&&small[1]>90);});
test("trade costs are reflected in a round trip",()=>{const b=bars();b[2].high=110;b[2].low=100;const s=[true,false,false,false,false,false],a=Array(b.length).fill(1);const r=run(b,s,a,{...CASES[0],tp:5,sl:2},0);assert.equal(r.trades,1);assert.ok(r.tradeLog[0].returnPct>4.5&&r.tradeLog[0].returnPct<5);});

test("stop and target are checked on the entry candle",()=>{const b=bars();b[1].high=102;b[1].low=99;const s=[true,false,false,false,false,false],a=Array(b.length).fill(1);const r=run(b,s,a,CASES[1],0);assert.equal(r.trades,1);assert.equal(r.tradeLog[0].exitTime,b[1].time);assert.equal(r.tradeLog[0].reason,"target");});
