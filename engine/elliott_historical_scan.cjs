"use strict";
const fs = require("node:fs");
const { scanBars } = require("./elliott_engine.cjs");
const path = process.argv[2];
if (!path) throw new Error("Usage: node engine/elliott_historical_scan.cjs data/BTCUSDT-1d.csv");
const lines = fs.readFileSync(path,"utf8").trim().split(/\r?\n/);
const header = lines.shift().split(",");
const idx = Object.fromEntries(header.map((x,i)=>[x,i]));
const bars = lines.map(line=>{
  const c=line.split(",");
  return {time:Number(c[idx.open_time]),open:Number(c[idx.open]),high:Number(c[idx.high]),low:Number(c[idx.low]),close:Number(c[idx.close])};
}).filter(b=>Object.values(b).every(Number.isFinite));
const result=scanBars(bars,{left:3,right:3});
const first=bars[0]?.time, last=bars.at(-1)?.time;
console.log(JSON.stringify({
  symbol:"BTCUSDT",timeframe:process.env.TIMEFRAME || "1d",source:path,
  firstOpenTime:first,lastOpenTime:last,bars:result.bars,pivots:result.pivots,
  impulseCandidates:result.impulseCandidates,zigzagCandidates:result.zigzagCandidates,
  sampleImpulses:result.impulses.slice(0,5),sampleZigzags:result.zigzags.slice(0,5),
  interpretation:"Counts are overlapping structural candidates, not unique waves, not accuracy, and not trade performance."
},null,2));
