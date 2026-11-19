/*
 * Ported from ebehinkaranzp-code/trading-dashboard/modules/strategy-engine.js
 * Source revision: d1b65bb5ab90f47f77fbc38f9d36b660d1c31c5c
 * Strategy signal engine for Trading Dashboard.
 * Implements the published rules from:
 * - crypto_systematic_research / Quattro Donchian v2 engine
 * - crypto-strategy-backtest / walk-forward TSMOM + volatility targeting
 * No orders are sent. Signals are calculated from closed candles only.
 */
(function (root) {
  'use strict';

  const DAY = 86400000;
  const LOOKBACKS = [7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];

  function ema(values, span) {
    const out = new Array(values.length).fill(null);
    const alpha = 2 / (span + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
      const v = Number(values[i]);
      if (!Number.isFinite(v)) continue;
      prev = prev === null ? v : alpha * v + (1 - alpha) * prev;
      out[i] = prev;
    }
    return out;
  }

  function atrWilder(candles, period = 14) {
    const out = new Array(candles.length).fill(null);
    let prevClose = null, prevAtr = null;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const tr = prevClose === null
        ? Number(c.high) - Number(c.low)
        : Math.max(Number(c.high) - Number(c.low), Math.abs(Number(c.high) - prevClose), Math.abs(Number(c.low) - prevClose));
      prevAtr = prevAtr === null ? tr : ((period - 1) * prevAtr + tr) / period;
      out[i] = prevAtr;
      prevClose = Number(c.close);
    }
    return out;
  }

  function std(values) {
    if (values.length < 2) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  function dailyTrendAt(barTime, daily, dailyEma, barClose) {
    let lo = 0, hi = daily.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (Number(daily[mid].time) + DAY <= barTime) { found = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (found < 0 || dailyEma[found] === null) return false;
    // Match the executable v2 engine: 4H close > the last available daily EMA200.
    return Number(barClose) > dailyEma[found];
  }

  function computeQuattro(fourHour, daily) {
    if (!Array.isArray(fourHour) || fourHour.length < 40) throw new Error('برای Quattro حداقل ۴۰ کندل ۴ساعته لازم است.');
    if (!Array.isArray(daily) || daily.length < 220) throw new Error('برای فیلتر EMA200 حداقل ۲۲۰ کندل روزانه لازم است.');

    const dClose = daily.map(x => Number(x.close));
    const dEma200 = ema(dClose, 200);
    const atr = atrWilder(fourHour, 14);
    const initialBalance = 1839.17;
    let balance = initialBalance;
    let units = [];
    let originalEntry = null, originalAtr = null, commonStop = null, accountAtEntry = null;
    let pendingExit = null;
    let lastAction = null;
    let lastExit = null;
    const feeRate = 0.0006; // source engine: 0.06% taker fee per side; funding omitted from signal simulation.

    const totalSize = () => units.reduce((s, u) => s + u.size, 0);
    const weightedEntry = () => totalSize() > 0 ? units.reduce((s, u) => s + u.entry * u.size, 0) / totalSize() : null;
    const pnlAt = price => units.reduce((s, u) => s + (price - u.entry) * u.size, 0);
    const closeTrade = (price, reason, bar) => {
      const size = totalSize();
      if (!size) return;
      const gross = pnlAt(price);
      const exitFee = size * price * feeRate;
      balance += gross - exitFee;
      lastExit = { price, reason, time: Number(bar.time), pnl: gross - exitFee };
      units = [];
      originalEntry = originalAtr = commonStop = accountAtEntry = null;
      pendingExit = null;
      if (bar === fourHour[fourHour.length - 1]) lastAction = { action: 'EXIT', time: Number(bar.time), price, reason };
    };

    for (let i = 1; i < fourHour.length; i++) {
      const bar = fourHour[i];
      const prev = fourHour.slice(Math.max(0, i - 20), i);
      const prev10 = fourHour.slice(Math.max(0, i - 10), i);
      if (prev.length < 20 || prev10.length < 10 || !Number.isFinite(atr[i])) continue;
      const prev20High = Math.max(...prev.map(x => Number(x.high)));
      const prev10Low = Math.min(...prev10.map(x => Number(x.low)));
      const isLast = i === fourHour.length - 1;

      if (pendingExit && units.length) {
        closeTrade(Number(bar.open), pendingExit, bar);
      }

      if (units.length) {
        const size = totalSize();
        const hardLoss = -0.05 * accountAtEntry;
        if (pnlAt(Number(bar.low)) <= hardLoss) {
          const stopPx = weightedEntry() + hardLoss / size;
          closeTrade(stopPx, 'hard_stop_5pct', bar);
          continue;
        }
        if (Number(bar.low) <= commonStop) {
          closeTrade(commonStop, 'atr_trailing_stop', bar);
          continue;
        }

        let added = false;
        while (units.length < 4) {
          const k = units.length + 1;
          const trigger = originalEntry + 0.5 * (k - 1) * originalAtr;
          if (Number(bar.high) < trigger) break;
          const unitSize = (balance * 0.02) / (2 * originalAtr);
          const unitEntry = trigger;
          const notional = unitSize * unitEntry;
          const existingNotional = units.reduce((sum, unit) => sum + unit.size * Number(bar.close), 0);
          if ((existingNotional + notional) / Math.max(balance, 1) > 20) break;
          balance -= notional * feeRate;
          units.push({ entry: unitEntry, size: unitSize });
          const nextStop = unitEntry - 2 * originalAtr;
          if (nextStop > commonStop) commonStop = nextStop;
          added = true;
          if (isLast) lastAction = { action: 'ADD', unit: units.length, time: Number(bar.time), price: unitEntry, stop: commonStop };
        }
        if (Number(bar.close) < prev10Low) {
          pendingExit = 'donchian_exit';
          if (isLast) lastAction = { action: 'EXIT', time: Number(bar.time), price: Number(bar.close), reason: 'donchian_exit_next_open' };
        }
        continue;
      }

      const trendUp = dailyTrendAt(Number(bar.time), daily, dEma200, Number(bar.close));
      if (Number(bar.close) > prev20High && trendUp) {
        const N = atr[i];
        const entryRef = i + 1 < fourHour.length ? Number(fourHour[i + 1].open) : Number(bar.close);
        const unitSize = (balance * 0.02) / (2 * N);
        if (entryRef > 0 && N > 0 && (unitSize * entryRef) / Math.max(balance, 1) <= 20) {
          if (i + 1 < fourHour.length) {
            originalEntry = entryRef;
            originalAtr = N;
            accountAtEntry = balance;
            commonStop = entryRef - 2 * N;
            units = [{ entry: entryRef, size: unitSize }];
            balance -= unitSize * entryRef * feeRate;
            // The signal is generated at bar i and filled at bar i+1 open.
            // Surface the fill event when the execution candle is the newest closed candle.
            if (i + 1 === fourHour.length - 1) {
              lastAction = { action: 'ENTRY', time: Number(fourHour[i + 1].time), signalTime: Number(bar.time), price: entryRef, stop: commonStop, atr: N };
            }
          } else {
            lastAction = { action: 'ENTRY_PENDING', time: Number(bar.time), price: Number(bar.close), stop: Number(bar.close) - 2 * N, atr: N, pending: true };
          }
        }
      }
    }

    const open = units.length > 0;
    return {
      strategy: 'quattro',
      status: open ? 'LONG' : (lastAction?.action === 'ENTRY_PENDING' ? 'ENTRY_PENDING' : 'FLAT'),
      action: lastAction,
      units: units.length,
      averageEntry: weightedEntry(),
      stop: commonStop,
      lastExit,
      price: Number(fourHour[fourHour.length - 1].close),
      candleTime: Number(fourHour[fourHour.length - 1].time),
      bars: fourHour.length,
      timeframe: '4h',
      note: 'قوانین موتور اجرایی Quattro v2؛ فیلتر: بسته‌شدن کندل ۴ساعته بالای EMA200 روزانه. کارمزد لحاظ شده؛ Funding در شبیه‌سازی سیگنال محاسبه نشده است.'
    };
  }

  function targetSeries(closes, lookback) {
    const n = closes.length;
    const raw = new Array(n).fill(0);
    const scaled = new Array(n).fill(0);
    const returns = new Array(n).fill(0);
    for (let i = 1; i < n; i++) returns[i] = closes[i] / closes[i - 1] - 1;
    for (let i = lookback; i < n; i++) {
      raw[i] = closes[i] / closes[i - lookback] - 1 > 0 ? 1 : 0;
      const volWindow = returns.slice(Math.max(1, i - 29), i + 1);
      const vol = volWindow.length >= 30 ? std(volWindow) * Math.sqrt(365) : null;
      const scale = vol && vol > 0 ? Math.min(1, 0.4 / vol) : 0;
      scaled[i] = raw[i] * scale;
    }
    // Same path-dependent 10% no-trade band as the research implementation.
    const out = new Array(n).fill(0);
    let current = null;
    for (let i = 0; i < n; i++) {
      const desired = scaled[i];
      if (current === null || desired === 0 || current === 0 || Math.abs(desired - current) > 0.10) current = desired;
      out[i] = current;
    }
    return { target: out, returns };
  }

  function scoreTarget(target, returns, start, end) {
    const net = [];
    let previousHeld = start >= 2 ? (target[start - 2] || 0) : 0;
    for (let t = Math.max(start, 1); t <= end; t++) {
      const held = target[t - 1] || 0; // one-day execution delay
      const turnover = Math.abs(held - previousHeld);
      net.push(held * returns[t] - turnover * 0.0015); // 10 bps fee + 5 bps slippage
      previousHeld = held;
    }
    const sd = std(net);
    return sd && sd > 0 ? (net.reduce((a, b) => a + b, 0) / net.length) / sd * Math.sqrt(365) : -Infinity;
  }

  function computeMomentum(daily, asset = 'BTC') {
    if (!Array.isArray(daily) || daily.length < 1500) throw new Error('برای Walk-forward واقعی به حداقل ۱۵۰۰ کندل روزانه آرشیوشده و زنده نیاز است.');
    const startDate = asset === 'ETH' ? Date.UTC(2016, 0, 1) : Date.UTC(2014, 0, 1);
    const data = daily.filter(x => Number(x.time) >= startDate).sort((a, b) => Number(a.time) - Number(b.time));
    const closes = data.map(x => Number(x.close));
    if (closes.length < 1500) throw new Error('داده روزانه کافی پس از پاک‌سازی موجود نیست.');
    const firstTestStart = Number(data[0].time) + 1460 * DAY; // 365 warm-up + 3-year training window
    const lastDate = Number(data[data.length - 1].time);
    if (lastDate < firstTestStart) throw new Error('تاریخچه برای اولین پنجره Walk-forward کافی نیست.');
    let foldIndex = Math.floor((lastDate - firstTestStart) / (182 * DAY));
    // Match the source walk-forward rule: if the final stub is under 45 days,
    // extend the preceding test fold instead of prematurely selecting new parameters.
    if (foldIndex > 0) {
      const priorStart = firstTestStart + (foldIndex - 1) * 182 * DAY;
      const priorTestEnd = priorStart + 181 * DAY;
      if ((lastDate - priorTestEnd) / DAY < 45) foldIndex -= 1;
    }
    const foldStart = firstTestStart + foldIndex * 182 * DAY;
    const trainStartTime = foldStart - 1095 * DAY;
    const trainStart = Math.max(1, data.findIndex(x => Number(x.time) >= trainStartTime));
    const trainEnd = Math.max(trainStart, data.findIndex(x => Number(x.time) >= foldStart) - 1);
    if (trainEnd - trainStart < 900) throw new Error('پنجره آموزش ۳ساله کامل نیست.');

    let best = null;
    for (const lookback of LOOKBACKS) {
      const { target, returns } = targetSeries(closes, lookback);
      const score = scoreTarget(target, returns, trainStart, trainEnd);
      if (!best || score > best.sharpe) best = { lookback, sharpe: score, target };
    }
    const current = best.target[best.target.length - 1] || 0;
    const previous = best.target[best.target.length - 2] || 0;
    let action = null;
    if (previous <= 0 && current > 0) action = { action: 'ENTRY', time: Number(data[data.length - 1].time), price: closes[closes.length - 1] };
    else if (previous > 0 && current <= 0) action = { action: 'EXIT', time: Number(data[data.length - 1].time), price: closes[closes.length - 1] };
    else if (previous > 0 && current > 0 && Math.abs(current - previous) > 0.10) action = { action: 'REBALANCE', time: Number(data[data.length - 1].time), price: closes[closes.length - 1], from: previous, to: current };

    return {
      strategy: 'momentum_vt',
      status: current > 0 ? 'LONG' : 'FLAT',
      action,
      lookback: best.lookback,
      trainingSharpe: best.sharpe,
      exposure: current,
      previousExposure: previous,
      price: closes[closes.length - 1],
      candleTime: Number(data[data.length - 1].time),
      bars: data.length,
      foldStart,
      trainStart: Number(data[trainStart].time),
      trainEnd: Number(data[trainEnd].time),
      timeframe: '1d',
      note: 'Walk-forward: آموزش ۳ ساله، آزمون ۱۸۲ روزه؛ سیگنال در بسته‌شدن روز و اجرای فرضی در بسته‌شدن روز بعد؛ long-only، هدف نوسان ۴۰٪، سقف تخصیص ۱۰۰٪ و باند عدم معامله ۱۰٪.'
    };
  }

  root.TDStrategyEngine = { computeQuattro, computeMomentum, ema, atrWilder };
})(window);
