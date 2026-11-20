"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateImpulse, validateZigzag, confirmedPivots } = require("./elliott_engine.cjs");

const bull = [
  {index:0,price:100,type:"L"},{index:2,price:120,type:"H"},
  {index:4,price:110,type:"L"},{index:6,price:145,type:"H"},
  {index:8,price:130,type:"L"},{index:10,price:155,type:"H"}
];
const bear = bull.map(p => ({...p,price:300-p.price,type:p.type==="L"?"H":"L"}));

test("accepts a bullish impulse satisfying the checked hard rules", () => {
  assert.equal(validateImpulse(bull).status, "valid_under_checked_rules");
});
test("accepts a bearish impulse satisfying the checked hard rules", () => {
  assert.equal(validateImpulse(bear).status, "valid_under_checked_rules");
});
test("rejects wave 2 beyond wave 1 origin", () => {
  const p=bull.map(x=>({...x})); p[2].price=99;
  assert.equal(validateImpulse(p).reason,"wave2_exceeds_origin_of_wave1");
});
test("rejects wave 3 as the shortest motive wave", () => {
  const p=bull.map(x=>({...x})); p[3].price=122; p[5].price=160;
  assert.equal(validateImpulse(p).reason,"wave3_is_shortest");
});
test("rejects wave 4 overlap in a standard impulse", () => {
  const p=bull.map(x=>({...x})); p[4].price=115;
  assert.equal(validateImpulse(p).reason,"wave4_overlaps_wave1_territory");
});
test("rejects wave 5 that fails to exceed wave 3 end", () => {
  const p=bull.map(x=>({...x})); p[5].price=140;
  assert.equal(validateImpulse(p).reason,"wave5_does_not_exceed_wave3_end");
});
test("accepts a basic bullish zigzag price sequence", () => {
  const p=[{index:0,price:100,type:"L"},{index:2,price:130,type:"H"},{index:4,price:115,type:"L"},{index:6,price:140,type:"H"}];
  assert.equal(validateZigzag(p).status,"candidate_under_basic_price_rules");
});
test("rejects zigzag B retracing beyond A origin", () => {
  const p=[{index:0,price:100,type:"L"},{index:2,price:130,type:"H"},{index:4,price:95,type:"L"},{index:6,price:140,type:"H"}];
  assert.equal(validateZigzag(p).reason,"abc_price_relationship_invalid");
});
test("rejects duplicate/non-alternating pivots", () => {
  const p=bull.map(x=>({...x})); p[2].type="H";
  assert.equal(validateImpulse(p).reason,"invalid_or_non_alternating_pivots");
});
test("pivot confirmation is delayed until right-side bars exist", () => {
  const bars=Array.from({length:9},(_,i)=>({time:i,high:[1,2,5,3,2,1,2,3,2][i],low:[0,1,2,1,0,-1,0,1,0][i]}));
  const pivots=confirmedPivots(bars,2,2);
  assert.ok(pivots.every(p=>p.confirmedAt===p.index+2));
  assert.ok(pivots.every(p=>p.confirmedAt<bars.length));
});
