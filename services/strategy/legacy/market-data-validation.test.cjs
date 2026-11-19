'use strict';
const assert = require('node:assert/strict');
const { validateCandles, computeValidatedQuattro, computeValidatedMomentum } = require('./market-data-validation.js');

const H4 = 4 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function bars(step, count = 3, start = 0) {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * step, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 10
  }));
}

const valid = bars(H4);
const now = 3 * H4 + 1000;
assert.equal(validateCandles(valid, { timeframe: '4h', now, maxAgeMs: 2000 }).length, 3);
assert.throws(() => validateCandles(valid, { timeframe: '4h', now, maxAgeMs: 500 }), /Stale/);
assert.throws(() => validateCandles(bars(H4), { timeframe: '4h', now: 2 * H4 + 1000, maxAgeMs: 5000 }), /not closed/);
assert.throws(() => validateCandles([valid[0], valid[0]], { timeframe: '4h', now, maxAgeMs: 5000 }), /strictly increasing/);
assert.throws(() => validateCandles([valid[0], { ...valid[1], time: 3 * H4 }], { timeframe: '4h', now: 4 * H4 + 1000, maxAgeMs: 5000 }), /gap detected/);
assert.throws(() => validateCandles([{ ...valid[0], high: 90 }], { timeframe: '4h', now, maxAgeMs: 5000 }), /OHLC range/);
assert.throws(() => validateCandles(valid, { timeframe: '4h', now, maxAgeMs: 5000, minBars: 4 }), /Insufficient/);
assert.throws(() => validateCandles(valid, { timeframe: '1m', now, maxAgeMs: 5000 }), /Unsupported timeframe/);
assert.throws(() => validateCandles([{ ...valid[0], time: 0.5 }], { timeframe: '4h', now, maxAgeMs: 5000 }), /Non-finite OHLC\/time/);
assert.throws(() => validateCandles(valid, { timeframe: '4h', now: now + 0.5, maxAgeMs: 5000 }), /safe integer/);

const daily = bars(DAY);
assert.equal(validateCandles(daily, { timeframe: '1d', now: 3 * DAY + 1000, maxAgeMs: 2000 }).length, 3);

console.log('PASS market-data-validation: closed bars, freshness, ordering, gaps, OHLC and minimum history');

const fakeEngine = {
  computeQuattro: (fourHour, dailyCandles) => ({ fourHour: fourHour.length, daily: dailyCandles.length }),
  computeMomentum: (dailyCandles, asset) => ({ daily: dailyCandles.length, asset })
};
const commonNow = 220 * DAY + 1000;
const daily220 = bars(DAY, 220);
const fourHour40 = bars(H4, 40, 220 * DAY - 40 * H4);
const qValidated = computeValidatedQuattro(fakeEngine, fourHour40, daily220, {
  now: commonNow, maxAgeMs4h: 2000, maxAgeMs1d: 2000
});
assert.deepEqual(qValidated, { fourHour: 40, daily: 220 });
assert.throws(() => computeValidatedQuattro(fakeEngine, fourHour40, daily220, {
  now: commonNow, maxAgeMs4h: 500, maxAgeMs1d: 2000
}), /Stale/);

const daily1500 = bars(DAY, 1500);
const momentumNow = 1500 * DAY + 1000;
const mValidated = computeValidatedMomentum(fakeEngine, daily1500, 'BTC', {
  now: momentumNow, maxAgeMs1d: 2000
});
assert.deepEqual(mValidated, { daily: 1500, asset: 'BTC' });
assert.throws(() => computeValidatedMomentum(fakeEngine, daily1500, 'BTC', {
  now: momentumNow, maxAgeMs1d: 500
}), /Stale/);

console.log('PASS validated wrappers: enforce minimum history and freshness before strategy calls');
