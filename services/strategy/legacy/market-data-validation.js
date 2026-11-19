'use strict';

const TIMEFRAMES = Object.freeze({ '4h': 4 * 60 * 60 * 1000, '1d': 24 * 60 * 60 * 1000 });

function validateCandles(candles, options = {}) {
  const { timeframe, now, maxAgeMs, minBars = 1 } = options;
  const timeframeMs = TIMEFRAMES[timeframe];

  if (!timeframeMs) throw new TypeError('Unsupported timeframe; use 4h or 1d.');
  if (!Number.isSafeInteger(now) || now <= 0) throw new TypeError('A safe integer UTC-millisecond now value is required.');
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError('A non-negative maxAgeMs is required.');
  if (!Number.isInteger(minBars) || minBars < 1) throw new TypeError('minBars must be a positive integer.');
  if (!Array.isArray(candles) || candles.length < minBars) {
    throw new RangeError(`Insufficient ${timeframe} candles: need at least ${minBars}.`);
  }

  const normalized = [];
  let previousTime = null;

  for (let i = 0; i < candles.length; i++) {
    const row = candles[i];
    if (!row || typeof row !== 'object') throw new TypeError(`Invalid candle at index ${i}.`);

    const time = Number(row.time);
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    const volume = row.volume == null ? undefined : Number(row.volume);

    if (!Number.isSafeInteger(time) || ![open, high, low, close].every(Number.isFinite)) {
      throw new TypeError(`Non-finite OHLC/time value at index ${i}.`);
    }
    if (time < 0 || [open, high, low, close].some(value => value <= 0)) {
      throw new RangeError(`Non-positive timestamp or price at index ${i}.`);
    }
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
      throw new RangeError(`Invalid OHLC range at index ${i}.`);
    }
    if (volume !== undefined && (!Number.isFinite(volume) || volume < 0)) {
      throw new RangeError(`Invalid volume at index ${i}.`);
    }
    if (previousTime !== null) {
      if (time <= previousTime) throw new RangeError('Candle timestamps must be strictly increasing.');
      if (time - previousTime !== timeframeMs) throw new RangeError('Candle gap detected; refusing to calculate on incomplete history.');
    }
    if (time + timeframeMs > now) throw new RangeError('Latest candle is not closed yet.');

    normalized.push({ time, open, high, low, close, ...(volume === undefined ? {} : { volume }) });
    previousTime = time;
  }

  const lastClosedAt = previousTime + timeframeMs;
  const ageMs = now - lastClosedAt;
  if (ageMs > maxAgeMs) throw new RangeError(`Stale ${timeframe} data: latest closed candle is ${ageMs}ms old.`);

  return normalized;
}

function computeValidatedQuattro(engine, fourHour, daily, options = {}) {
  if (!engine || typeof engine.computeQuattro !== 'function') throw new TypeError('A compatible strategy engine is required.');
  const fourHourSafe = validateCandles(fourHour, {
    timeframe: '4h', now: options.now, maxAgeMs: options.maxAgeMs4h, minBars: 40
  });
  const dailySafe = validateCandles(daily, {
    timeframe: '1d', now: options.now, maxAgeMs: options.maxAgeMs1d, minBars: 220
  });
  return engine.computeQuattro(fourHourSafe, dailySafe);
}

function computeValidatedMomentum(engine, daily, asset, options = {}) {
  if (!engine || typeof engine.computeMomentum !== 'function') throw new TypeError('A compatible strategy engine is required.');
  const dailySafe = validateCandles(daily, {
    timeframe: '1d', now: options.now, maxAgeMs: options.maxAgeMs1d, minBars: 1500
  });
  return engine.computeMomentum(dailySafe, asset);
}

module.exports = { validateCandles, computeValidatedQuattro, computeValidatedMomentum, TIMEFRAMES };
