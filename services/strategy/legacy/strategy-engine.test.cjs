'use strict';
const assert = require('node:assert/strict');

global.window = global;
require('./strategy-engine.js');
const engine = global.TDStrategyEngine;

assert.deepEqual(engine.ema([1, 2, 3], 2).map(x => Number(x.toFixed(6))), [1, 1.666667, 2.555556]);
assert.throws(() => engine.computeQuattro([], []), /۴۰ کندل/);
assert.throws(() => engine.computeMomentum([], 'BTC'), /۱۵۰۰ کندل/);

function makeDaily(count, start = Date.UTC(2020, 0, 1), base = 100) {
  const rows = [];
  let close = base;
  for (let i = 0; i < count; i++) {
    const ret = 0.0008 + Math.sin(i * 0.19) * 0.003 + Math.cos(i * 0.037) * 0.0015;
    close *= 1 + ret;
    rows.push({ time: start + i * 86400000, open: close, high: close * 1.01, low: close * 0.99, close, volume: 100 });
  }
  return rows;
}

for (const asset of ['BTC', 'ETH']) {
  const result = engine.computeMomentum(makeDaily(1600), asset);
  assert.ok(result.lookback > 0);
  assert.ok(Number.isFinite(result.trainingSharpe));
  assert.ok(result.exposure >= 0 && result.exposure <= 1);
  assert.equal(result.timeframe, '1d');
}

const dailyTrend = makeDaily(320, Date.UTC(2025, 0, 1), 100);
const fourHour = [];
let price = 100;
for (let i = 0; i < 1000; i++) {
  price *= 1.004;
  fourHour.push({
    time: Date.UTC(2025, 0, 1) + i * 4 * 3600000,
    open: price / 1.004,
    high: price * 1.0005,
    low: price * 0.9995,
    close: price,
    volume: 10
  });
}
const quattro = engine.computeQuattro(fourHour, dailyTrend);
assert.equal(quattro.strategy, 'quattro');
assert.equal(quattro.timeframe, '4h');
assert.ok(['LONG', 'FLAT'].includes(quattro.status));
assert.ok(quattro.units >= 0 && quattro.units <= 4);
if (quattro.status === 'LONG') {
  assert.ok(Number.isFinite(quattro.averageEntry));
  assert.ok(Number.isFinite(quattro.stop));
}

// Regression: breakout on the penultimate candle must fill at the next open.
const flat = [];
for (let i = 0; i < 58; i++) {
  flat.push({ time: Date.UTC(2025, 0, 1) + i * 4 * 3600000, open: 100, high: 101, low: 99, close: 100, volume: 10 });
}
flat.push({ time: Date.UTC(2025, 0, 1) + 58 * 4 * 3600000, open: 100, high: 121, low: 99, close: 120, volume: 10 });
flat.push({ time: Date.UTC(2025, 0, 1) + 59 * 4 * 3600000, open: 120, high: 121, low: 119, close: 120.5, volume: 10 });
const regression = engine.computeQuattro(flat, makeDaily(320, Date.UTC(2025, 0, 1), 100));
assert.equal(regression.action?.action, 'ENTRY');
assert.equal(regression.action?.price, 120);

console.log('PASS strategy-engine: EMA, input guards, BTC/ETH momentum, Quattro state, next-open fill regression');
