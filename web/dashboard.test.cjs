'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync('web/index.html', 'utf8');
const openTag = '<script>', closeTag = '</script>';
const scriptStart = html.indexOf(openTag) + openTag.length;
const scriptEnd = html.indexOf(closeTag, scriptStart);
assert.ok(scriptStart >= openTag.length && scriptEnd > scriptStart, 'dashboard inline script missing');
assert.equal(html.indexOf(openTag, scriptEnd), -1, 'dashboard must contain exactly one inline script');
const source = html.slice(scriptStart, scriptEnd);
new vm.Script(source);
assert.match(html, /data-api\.binance\.vision/);
assert.match(html, /stream\.binance\.com/);
assert.match(html, /TRADINGVIEW/);
assert.match(source, /function validBar\(b\)/);
assert.match(source, /function escapeHtml\(value\)/);
assert.match(source, /function scheduleReconnect\(generation\)/);
assert.match(source, /function websocketIsStale\(readyState,lastMessage/);
assert.match(source, /async function refreshBars\(\)/);
assert.match(source, /function closedBarCount\(\)/);
assert.match(source, /REST FALLBACK/);
assert.match(source, /Date\.now\(\)-lastWsMessage>45000/);
assert.match(source, /Exchange request timed out after 12 seconds/);
const legacyHtml = fs.readFileSync('web/analysis-legacy.html', 'utf8');
const legacyStart = legacyHtml.indexOf(openTag) + openTag.length;
const legacyEnd = legacyHtml.indexOf(closeTag, legacyStart);
const legacySource = legacyHtml.slice(legacyStart, legacyEnd);
new vm.Script(legacySource);

function extractBetween(startName, endName) {
  const start = legacySource.indexOf('function ' + startName + '(');
  const end = legacySource.indexOf((endName.startsWith('async ') ? endName : 'function ' + endName + '('), start);
  assert.ok(start >= 0 && end > start, 'could not extract ' + startName);
  return legacySource.slice(start, end);
}
function helpers(code) {
  const context = {};
  vm.runInNewContext(code, context);
  return context;
}
const csv = helpers(extractBetween('parseCsvRows', 'csvTime'));
const valid = helpers(extractBetween('validCandles', 'weeklyFromDaily'));
const weekly = helpers(extractBetween('weeklyFromDaily', 'auditCandles'));
const continuity = helpers(extractBetween('isContinuousClosed', 'async function renderStrategySuite'));
const validBarStart = source.indexOf('function validBar(');
const validBarEnd = source.indexOf('\nasync function loadBars', validBarStart);
assert.ok(validBarStart >= 0 && validBarEnd > validBarStart, 'dashboard candle validator missing');
const validBar = vm.runInNewContext(source.slice(validBarStart, validBarEnd) + '; validBar');
const escapeStart = source.indexOf('function escapeHtml(');
const escapeEnd = source.indexOf('\nconst tfMs', escapeStart);
assert.ok(escapeStart >= 0 && escapeEnd > escapeStart, 'HTML escaping helper missing');
const escapeHtml = vm.runInNewContext(source.slice(escapeStart, escapeEnd) + '; escapeHtml');
const closedCountStart = source.indexOf('function closedBarCount(');
const closedCountEnd = source.indexOf('\nasync function loadBars', closedCountStart);
assert.ok(closedCountStart >= 0 && closedCountEnd > closedCountStart, 'closed candle counter missing');
const footprintStart = source.indexOf('function footprintPoc(');
const footprintEnd = source.indexOf('\nfunction renderFootprint', footprintStart);
assert.ok(footprintStart >= 0 && footprintEnd > footprintStart, 'footprint ranking helpers missing');
const footprint = vm.runInNewContext(source.slice(footprintStart, footprintEnd) + '; ({footprintPoc, footprintDisplayRows})');
const paperStart = source.indexOf('function newPaperAccount(');
const paperEnd = source.indexOf('\nfunction renderPaper', paperStart);
assert.ok(paperStart >= 0 && paperEnd > paperStart, 'paper accounting helpers missing');
const paper = vm.runInNewContext(source.slice(paperStart, paperEnd) + '; ({newPaperAccount, normalizePaperAccount, applyPaperFill})');
const localArrayStart = source.indexOf('function loadLocalArray(');
const localArrayEnd = source.indexOf('\nfunction newPaperAccount', localArrayStart);
assert.ok(localArrayStart >= 0 && localArrayEnd > localArrayStart, 'local array loader missing');
const localArrayLoader = vm.runInNewContext(source.slice(localArrayStart, localArrayEnd) + '; loadLocalArray');

test('CSV parser supports comma, semicolon, tab and quoted cells', () => {
  for (const delimiter of [',', ';', '\t']) {
    const parsed = csv.parseCsvRows('time' + delimiter + 'open' + delimiter + 'note\n1' + delimiter + '2' + delimiter + '"a' + delimiter + 'b"');
    assert.equal(parsed.length, 2);
    assert.equal(parsed[1][0], '1');
    assert.equal(parsed[1][1], '2');
    assert.equal(parsed[1][2], 'a' + delimiter + 'b');
  }
});

test('OHLCV validator rejects duplicate timestamps and invalid candle ranges', () => {
  const base = Date.UTC(2026, 1, 1);
  const bars = Array.from({length: 31}, (_, i) => ({open_time:base+i*3600000,close_time:base+(i+1)*3600000-1,open:100,high:102,low:99,close:101,volume:4}));
  assert.equal(valid.validCandles(bars), true);
  const duplicate = bars.map(x => ({...x}));
  duplicate[10].open_time = duplicate[9].open_time;
  assert.equal(valid.validCandles(duplicate), false);
  const invalid = bars.map(x => ({...x}));
  invalid[8].low = 105;
  assert.equal(valid.validCandles(invalid), false);
});

test('weekly aggregation uses only complete seven-day UTC weeks', () => {
  const day = 86400000, start = Date.UTC(2026, 0, 5);
  const bars = Array.from({length: 17}, (_, i) => ({open_time:start+i*day,close_time:start+(i+1)*day-1,open:100+i,high:105+i,low:98+i,close:102+i,volume:10}));
  const result = weekly.weeklyFromDaily(bars);
  assert.equal(result.length, 2);
  assert.equal(result[0].open, 100);
  assert.equal(result[0].close, 108);
  assert.equal(result[0].volume, 70);
});

test('continuous closed-candle check rejects gaps', () => {
  const day = 86400000, start = Date.UTC(2020, 0, 1);
  const bars = Array.from({length: 3}, (_, i) => ({open_time:start+i*day,close_time:start+(i+1)*day-1}));
  assert.equal(continuity.isContinuousClosed(bars, '1d'), true);
  bars[2].open_time += day;
  assert.equal(continuity.isContinuousClosed(bars, '1d'), false);
});

test('preserved strategy engine loads and evaluates a closed-candle Quattro series', () => {
  const marker = legacySource.indexOf('/*\n * Ported from');
  assert.ok(marker >= 0, 'legacy strategy engine must be embedded');
  const context = {window:{}};
  vm.runInNewContext(legacySource.slice(marker), context);
  const engine = context.window.TDStrategyEngine;
  assert.equal(typeof engine.computeQuattro, 'function');
  assert.equal(typeof engine.computeMomentum, 'function');
  assert.throws(() => engine.computeMomentum([], 'BTC'), /حداقل ۱۵۰۰/);
  const day = 86400000, start = Date.UTC(2026, 0, 5);
  const daily = Array.from({length:250}, (_, i) => ({time:start+i*day,open:100+i,high:103+i,low:98+i,close:101+i,volume:100}));
  const fourHour = Array.from({length:250}, (_, i) => ({time:start+i*4*3600000,open:100+i,high:103+i,low:98+i,close:101+i,volume:20}));
  const result = engine.computeQuattro(fourHour, daily);
  assert.ok(['LONG','FLAT','ENTRY_PENDING'].includes(result.status));
  assert.equal(result.timeframe, '4h');

  const momentumStart = Date.UTC(2014, 0, 1), dayMs = 86400000;
  const momentumBars = Array.from({length:1500}, (_, i) => {
    const close = 100 * Math.exp(0.0004 * i + 0.01 * Math.sin(i / 17));
    return {time:momentumStart+i*dayMs,open:close*0.999,high:close*1.005,low:close*0.995,close,volume:100};
  });
  const momentum = engine.computeMomentum(momentumBars, 'BTC');
  assert.equal(momentum.bars, 1500);
  assert.equal(momentum.timeframe, '1d');
  assert.ok([7,14,21,30,45,60,90,120,180,270,365].includes(momentum.lookback));
  assert.ok(Number.isFinite(momentum.trainingSharpe));
});


test('dashboard candle validator accepts valid OHLCV and rejects malformed exchange rows', () => {
  const good = {time:1000,closeTime:1999,open:100,high:105,low:98,close:103,volume:12};
  assert.equal(validBar(good), true);
  assert.equal(validBar({...good, high:99}), false);
  assert.equal(validBar({...good, low:104}), false);
  assert.equal(validBar({...good, volume:NaN}), false);
  assert.equal(validBar({...good, closeTime:999}), false);
});


test('journal text is escaped before insertion into dashboard HTML', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> &'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;');
  assert.equal(escapeHtml("it's safe"), 'it&#39;s safe');
});


test('closed candle count excludes the still-forming exchange candle', () => {
  const now = Date.now();
  const ctx = {bars:[{closeTime:now-1},{closeTime:now+60000}]};
  const count = vm.runInNewContext(source.slice(closedCountStart, closedCountEnd) + '; closedBarCount', ctx);
  assert.equal(count(), 1);
});

test('footprint POC uses every price level while display rows prioritize traded volume', () => {
  const rows = Array.from({length:30}, (_, i) => ({p:100-i,buy:1,sell:0}));
  rows[29] = {p:71,buy:80,sell:20};
  const visible = footprint.footprintDisplayRows(rows, 24);
  assert.equal(visible.length, 24);
  assert.ok(visible.some(row => row.p === 71), 'high-volume level should not be dropped');
  assert.equal(footprint.footprintPoc(rows).p, 71, 'POC must be calculated from all levels');
});

test('paper account tracks separate positions and correct partial-close P&L', () => {
  const account = paper.newPaperAccount();
  assert.equal(paper.applyPaperFill(account, 'BTCUSDT', 'BUY', 100, 2).ok, true);
  assert.equal(paper.applyPaperFill(account, 'BTCUSDT', 'SELL', 110, 1).ok, true);
  assert.equal(paper.applyPaperFill(account, 'ETHUSDT', 'BUY', 50, 2).ok, true);
  assert.equal(account.positions.BTCUSDT.qty, 1);
  assert.equal(account.positions.BTCUSDT.avg, 100);
  assert.equal(account.positions.ETHUSDT.qty, 2);
  assert.equal(account.positions.ETHUSDT.avg, 50);
  assert.equal(account.cash, 99810);
  assert.equal(account.realized, 10);
  assert.equal(account.trades[2].symbol, 'ETHUSDT');
});

test('paper account migrates the previous single-position BTC format', () => {
  const account = paper.normalizePaperAccount({cash: 99800, qty: 2, avg: 100, realized: 0, trades: []});
  assert.equal(account.positions.BTCUSDT.qty, 2);
  assert.equal(account.positions.BTCUSDT.avg, 100);
  assert.equal(account.positions.ETHUSDT, undefined);
});

test('paper fills reject invalid orders and insufficient virtual cash', () => {
  const account = paper.newPaperAccount();
  assert.equal(paper.applyPaperFill(account, 'BTCUSDT', 'BUY', 100, -1).ok, false);
  assert.equal(paper.applyPaperFill(account, 'BTCUSDT', 'BUY', 1000000, 1).reason, 'Insufficient virtual cash');
  assert.equal(paper.applyPaperFill(account, 'BTCUSDT', 'SELL', 100, 1).reason, 'No simulated position to reduce');
});

test('malformed or non-array local browser state safely falls back to an empty array', () => {
  const malformed = vm.runInNewContext(source.slice(localArrayStart, localArrayEnd) + '; loadLocalArray', {
    localStorage: {getItem: () => '{not-json'}
  });
  const wrongShape = vm.runInNewContext(source.slice(localArrayStart, localArrayEnd) + '; loadLocalArray', {
    localStorage: {getItem: () => '{"unexpected":true}'}
  });
  assert.deepEqual(Array.from(malformed('drawings')), []);
  assert.deepEqual(Array.from(wrongShape('alerts')), []);
  const mixed = vm.runInNewContext(source.slice(localArrayStart, localArrayEnd) + '; loadLocalArray', {
    localStorage: {getItem: () => '[null,"invalid",{"id":1}]'}
  });
  assert.equal(Array.from(mixed('drawings')).length, 1);
});

test('stale open WebSocket is detected while healthy and closed sockets are not', () => {
  const start = source.indexOf('function websocketIsStale(');
  const end = source.indexOf('\\nasync function refreshBars', start);
  assert.ok(start >= 0 && end > start, 'WebSocket staleness helper missing');
  const isStale = vm.runInNewContext(source.slice(start, end) + '; websocketIsStale');
  assert.equal(isStale(1, 1000, 46001, 1), true);
  assert.equal(isStale(1, 1000, 46000, 1), false);
  assert.equal(isStale(3, 1000, 90000, 1), false);
  assert.equal(isStale(1, 50000, 1000, 1), false);
});
