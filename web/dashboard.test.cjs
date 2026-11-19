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

function extractBetween(startName, endName) {
  const start = source.indexOf('function ' + startName + '(');
  const end = source.indexOf((endName.startsWith('async ') ? endName : 'function ' + endName + '('), start);
  assert.ok(start >= 0 && end > start, 'could not extract ' + startName);
  return source.slice(start, end);
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
  const marker = source.indexOf('/*\n * Ported from');
  assert.ok(marker >= 0, 'legacy strategy engine must be embedded');
  const context = {window:{}};
  vm.runInNewContext(source.slice(marker), context);
  const engine = context.window.TDStrategyEngine;
  assert.equal(typeof engine.computeQuattro, 'function');
  const day = 86400000, start = Date.UTC(2026, 0, 5);
  const daily = Array.from({length:250}, (_, i) => ({time:start+i*day,open:100+i,high:103+i,low:98+i,close:101+i,volume:100}));
  const fourHour = Array.from({length:250}, (_, i) => ({time:start+i*4*3600000,open:100+i,high:103+i,low:98+i,close:101+i,volume:20}));
  const result = engine.computeQuattro(fourHour, daily);
  assert.ok(['LONG','FLAT','ENTRY_PENDING'].includes(result.status));
  assert.equal(result.timeframe, '4h');
});
