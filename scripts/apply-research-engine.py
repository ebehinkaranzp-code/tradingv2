#!/usr/bin/env python3
"""Install Trading V2's custom closed-candle research module into Tradoor."""
from pathlib import Path
import sys

web = Path(sys.argv[1] if len(sys.argv) > 1 else "tradoor-source/web")
legacy = Path(sys.argv[2] if len(sys.argv) > 2 else "web/analysis-legacy.html")

def replace(path: str, old: str, new: str) -> None:
    p = web / path
    source = p.read_text(encoding="utf-8")
    if old not in source:
        if new and new in source:
            return
        if not new:
            return
        raise SystemExit(f"Expected integration point missing in {p}: {old[:100]!r}")
    p.write_text(source.replace(old, new, 1), encoding="utf-8")

# Port the exact Quattro Donchian v2 and walk-forward TSMOM engine already
# maintained in Trading V2's legacy source; do not rewrite its rule set here.
legacy_text = legacy.read_text(encoding="utf-8")
start = legacy_text.find("/*\n * Ported from")
if start < 0:
    raise SystemExit(f"Strategy engine marker missing in {legacy}")
end_marker = "})(window);"
end = legacy_text.find(end_marker, start)
if end < 0:
    raise SystemExit(f"Strategy engine terminator missing in {legacy}")
block = legacy_text[start:end + len(end_marker)]
wrapper = "(function (root) {"
w = block.find(wrapper)
assign = "  root.TDStrategyEngine = { computeQuattro, computeMomentum, ema, atrWilder };"
a = block.find(assign)
if w < 0 or a < 0:
    raise SystemExit("Could not isolate the preserved strategy engine")
header = block[:w].strip()
body = block[w + len(wrapper):a]
body = body.replace("  'use strict';\n", "", 1)
engine = (
    "// @ts-nocheck -- preserved strategy implementation; input validation is in ResearchPanel.\n"
    + header + "\n"
    + "export const TDStrategyEngine = (() => {\n"
    + body.rstrip()
    + "\n  return { computeQuattro, computeMomentum, ema, atrWilder };\n})();\n"
)
research_dir = web / "src/research"
research_dir.mkdir(parents=True, exist_ok=True)
(research_dir / "strategies.ts").write_text(engine, encoding="utf-8")

neo_wave = '''/** Independent NEoWave engine contract. No wave count is emitted until a separately tested engine is installed. */
export type NeoWaveCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export interface NeoWaveInput {
  market: string;
  timeframe: string;
  candles: readonly NeoWaveCandle[];
}
export interface NeoWaveSwing {
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  degree: string;
  label: string;
}
export interface NeoWaveResult {
  swings: readonly NeoWaveSwing[];
  invalidationPrice: number | null;
  explanation: string;
}
export interface NeoWaveEngine {
  readonly id: 'neo-wave';
  readonly version: string;
  analyze(input: NeoWaveInput): NeoWaveResult;
}
export const neoWaveExtensionPoint = {
  id: 'neo-wave',
  status: 'reserved',
  description: 'Independent engine contract only. No automatic wave count is published without validated rules and tests.',
} as const;
'''
(research_dir / "neo-wave.ts").write_text(neo_wave, encoding="utf-8")

tests = '''import { TDStrategyEngine } from './strategies.ts';

Deno.test('Quattro refuses missing 4H and daily history', () => {
  let threw = false;
  try { TDStrategyEngine.computeQuattro([], []); } catch { threw = true; }
  if (!threw) throw new Error('Quattro must reject insufficient candle history');
});

Deno.test('TSMOM refuses fewer than 1,500 daily candles', () => {
  let threw = false;
  try { TDStrategyEngine.computeMomentum([], 'BTC'); } catch { threw = true; }
  if (!threw) throw new Error('TSMOM must reject insufficient daily history');
});
'''
(research_dir / "strategies_test.ts").write_text(tests, encoding="utf-8")

panel = r'''import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { ResearchPanelState } from '../workspace/model';
import { TDStrategyEngine } from '../research/strategies';
import './research.css';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number; closeTime: number };
type Audit = { bars: Candle[]; gaps: number; invalid: number; duplicates: number; stale: boolean; received: number };
type Metric = { result: any | null; error: string | null; audit: Audit };
type Snapshot = { quattro: Metric; quattroDaily: Audit; btc: Metric; eth: Metric; updatedAt: number };

const DAY = 86_400_000;
const FOUR_HOURS = 14_400_000;
const SPOT = 'https://data-api.binance.vision/api/v3';
const FUTURES = 'https://fapi.binance.com/fapi/v1';
const fmt = (n: unknown, digits = 2): string => n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
const when = (t: unknown): string => t === null || t === undefined || !Number.isFinite(Number(t)) ? '—' : new Date(Number(t)).toLocaleString();

async function fetchKlines(base: string, symbol: string, interval: string, limit: number, endTime?: number): Promise<unknown[]> {
  const url = new URL(base + '/klines');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', String(limit));
  if (endTime !== undefined) url.searchParams.set('endTime', String(endTime));
  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) throw new Error(symbol + ' ' + interval + ': exchange HTTP ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(symbol + ' ' + interval + ': invalid exchange response');
  return data;
}

async function spotDaily1500(symbol: string): Promise<unknown[]> {
  const newest = await fetchKlines(SPOT, symbol, '1d', 1000);
  if (newest.length < 1000) return newest;
  const first = newest[0] as unknown[];
  const oldestTime = Number(first[0]);
  if (!Number.isFinite(oldestTime)) throw new Error(symbol + ': invalid oldest candle time');
  const older = await fetchKlines(SPOT, symbol, '1d', 1000, oldestTime - 1);
  return [...older, ...newest];
}

function audit(raw: unknown[], intervalMs: number, keep: number): Audit {
  const now = Date.now();
  const unique = new Map<number, Candle>();
  let invalid = 0;
  let duplicates = 0;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 7) { invalid++; continue; }
    const c: Candle = {
      time: Number(row[0]), open: Number(row[1]), high: Number(row[2]),
      low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
      closeTime: Number(row[6]),
    };
    // The forming candle is deliberately excluded from every strategy.
    if (!Number.isFinite(c.closeTime) || c.closeTime >= now) continue;
    const valid = [c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)
      && c.time > 0 && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0 && c.volume >= 0
      && c.time % intervalMs === 0 && c.closeTime === c.time + intervalMs - 1\n      && c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close, c.high);
    if (!valid) { invalid++; continue; }
    if (unique.has(c.time)) duplicates++;
    unique.set(c.time, c);
  }
  const bars = [...unique.values()].sort((a, b) => a.time - b.time).slice(-keep);
  let gaps = 0;
  for (let i = 1; i < bars.length; i++) if (bars[i]!.time - bars[i - 1]!.time !== intervalMs) gaps++;
  const latestClose = bars.length ? bars[bars.length - 1]!.closeTime + 1 : 0;
  const stale = !latestClose || now - latestClose > intervalMs * 2;
  return { bars, gaps, invalid, duplicates, stale, received: raw.length };
}

function metric(a: Audit, minimum: number, run: () => any): Metric {
  if (a.bars.length < minimum) return { result: null, error: 'Insufficient closed candles: ' + a.bars.length + ' / ' + minimum, audit: a };
  if (a.gaps || a.invalid || a.duplicates || a.stale) {
    return { result: null, error: 'Data integrity gate blocked the signal. Gaps: ' + a.gaps + ', invalid: ' + a.invalid + ', duplicates: ' + a.duplicates + ', stale: ' + (a.stale ? 'yes' : 'no'), audit: a };
  }
  try { return { result: run(), error: null, audit: a }; }
  catch (e) { return { result: null, error: e instanceof Error ? e.message : String(e), audit: a }; }
}

const tone = (status?: string): string => status === 'LONG' ? 'research-long' : status === 'FLAT' ? 'research-flat' : 'research-wait';
const actionText = (action: any): string => action ? action.action + ' · ' + fmt(action.price) : 'No new event on the latest closed candle';

export function ResearchPanel(_props: { panel: ResearchPanelState }) {
  const [snapshot, setSnapshot] = createSignal<Snapshot | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [updated, setUpdated] = createSignal(0);

  const refresh = async () => {
    if (busy()) return;
    setBusy(true);
    setError('');
    try {
      const [q4Raw, qdRaw, btcRaw, ethRaw] = await Promise.all([
        fetchKlines(FUTURES, 'BTCUSDT', '4h', 80),
        fetchKlines(FUTURES, 'BTCUSDT', '1d', 260),
        spotDaily1500('BTCUSDT'),
        spotDaily1500('ETHUSDT'),
      ]);
      const q4Audit = audit(q4Raw, FOUR_HOURS, 80);
      const qdAudit = audit(qdRaw, DAY, 260);
      const btcAudit = audit(btcRaw, DAY, 1500);
      const ethAudit = audit(ethRaw, DAY, 1500);
      const q4 = q4Audit.bars;
      const qd = qdAudit.bars;
      const btc = btcAudit.bars;
      const eth = ethAudit.bars;
      const quattro = metric(
        { ...q4Audit, bars: q4Audit.bars.slice(-60) },
        40,
        () => {
          if (qd.length < 220 || qdAudit.gaps || qdAudit.invalid || qdAudit.duplicates || qdAudit.stale) throw new Error('BTC perpetual daily history must contain 220+ continuous, valid, closed candles.');
          return TDStrategyEngine.computeQuattro(q4.slice(-60), qd);
        },
      );
      const btcMomentum = metric(btcAudit, 1500, () => TDStrategyEngine.computeMomentum(btc, 'BTC'));
      const ethMomentum = metric(ethAudit, 1500, () => TDStrategyEngine.computeMomentum(eth, 'ETH'));
      setSnapshot({ quattro, quattroDaily: qdAudit, btc: btcMomentum, eth: ethMomentum, updatedAt: Date.now() });
      setUpdated(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  onMount(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60_000);
    onCleanup(() => clearInterval(timer));
  });

  const snap = () => snapshot();
  return (
    <div class="panelcol research-panel">
      <div class="research-toolbar">
        <div><strong>RESEARCH LAB</strong><span> CLOSED-CANDLE STRATEGIES · NO LIVE ORDERS</span></div>
        <button type="button" disabled={busy()} onClick={() => void refresh()}>{busy() ? 'UPDATING…' : 'REFRESH DATA'}</button>
      </div>
      <div class="research-source">Sources: Binance USDⓈ-M perpetual and Binance Spot public REST · Forming candles excluded · UTC continuity checked</div>
      <Show when={error()}>
        <div class="research-error">{error()}</div>
      </Show>
      <Show when={!snap() && busy()}>
        <div class="research-empty">Loading real exchange history. No sample candles or placeholder signals are used.</div>
      </Show>
      <Show when={snap()}>
        <div class="research-grid">
          <section class="research-card">
            <header><div><small>BTCUSDT · USDⓈ-M PERPETUAL</small><h3>Quattro Donchian v2</h3></div><b class={tone(snap()!.quattro.result?.status)}>{snap()!.quattro.result?.status ?? 'WAITING'}</b></header>
            <div class="research-event">{snap()!.quattro.error ?? actionText(snap()!.quattro.result?.action)}</div>
            <div class="research-metrics">
              <div><span>4H candles</span><b>{snap()!.quattro.audit.bars.length}</b></div>
              <div><span>Daily candles</span><b>{snap()!.quattroDaily.bars.length}</b></div>
              <div><span>Units</span><b>{fmt(snap()!.quattro.result?.units, 0)}</b></div>
              <div><span>Average entry</span><b>{fmt(snap()!.quattro.result?.averageEntry)}</b></div>
              <div><span>Shared stop</span><b>{fmt(snap()!.quattro.result?.stop)}</b></div>
              <div><span>Latest close</span><b>{fmt(snap()!.quattro.result?.price)}</b></div>
            </div>
            <p>{snap()!.quattro.result?.note ?? 'Requires at least 40 continuous closed 4H candles and 220 continuous closed daily candles.'}</p>
          </section>
          <section class="research-card">
            <header><div><small>BTCUSDT · SPOT · 1D</small><h3>TSMOM + Volatility Targeting</h3></div><b class={tone(snap()!.btc.result?.status)}>{snap()!.btc.result?.status ?? 'WAITING'}</b></header>
            <div class="research-event">{snap()!.btc.error ?? actionText(snap()!.btc.result?.action)}</div>
            <div class="research-metrics">
              <div><span>Daily candles</span><b>{snap()!.btc.audit.bars.length}</b></div>
              <div><span>Lookback</span><b>{snap()!.btc.result?.lookback ?? '—'} days</b></div>
              <div><span>Exposure</span><b>{snap()!.btc.result ? fmt(Number(snap()!.btc.result.exposure) * 100, 1) + '%' : '—'}</b></div>
              <div><span>Training Sharpe</span><b>{fmt(snap()!.btc.result?.trainingSharpe, 2)}</b></div>
              <div><span>Latest close</span><b>{fmt(snap()!.btc.result?.price)}</b></div>
              <div><span>As of</span><b>{when(snap()!.btc.result?.candleTime)}</b></div>
            </div>
            <p>{snap()!.btc.result?.note ?? 'Requires 1,500 continuous closed daily candles and a complete walk-forward training window.'}</p>
          </section>
          <section class="research-card">
            <header><div><small>ETHUSDT · SPOT · 1D</small><h3>TSMOM + Volatility Targeting</h3></div><b class={tone(snap()!.eth.result?.status)}>{snap()!.eth.result?.status ?? 'WAITING'}</b></header>
            <div class="research-event">{snap()!.eth.error ?? actionText(snap()!.eth.result?.action)}</div>
            <div class="research-metrics">
              <div><span>Daily candles</span><b>{snap()!.eth.audit.bars.length}</b></div>
              <div><span>Lookback</span><b>{snap()!.eth.result?.lookback ?? '—'} days</b></div>
              <div><span>Exposure</span><b>{snap()!.eth.result ? fmt(Number(snap()!.eth.result.exposure) * 100, 1) + '%' : '—'}</b></div>
              <div><span>Training Sharpe</span><b>{fmt(snap()!.eth.result?.trainingSharpe, 2)}</b></div>
              <div><span>Latest close</span><b>{fmt(snap()!.eth.result?.price)}</b></div>
              <div><span>As of</span><b>{when(snap()!.eth.result?.candleTime)}</b></div>
            </div>
            <p>{snap()!.eth.result?.note ?? 'Requires 1,500 continuous closed daily candles and a complete walk-forward training window.'}</p>
          </section>
        </div>
        <div class="research-quality">
          <strong>DATA INTEGRITY</strong>
          <span>Quattro 4H: {snap()!.quattro.audit.bars.length} bars · {snap()!.quattro.audit.gaps} gaps</span>\n          <span>Quattro 1D: {snap()!.quattroDaily.bars.length} bars · {snap()!.quattroDaily.gaps} gaps</span>
          <span>BTC spot 1D: {snap()!.btc.audit.bars.length} bars · {snap()!.btc.audit.gaps} gaps</span>
          <span>ETH spot 1D: {snap()!.eth.audit.bars.length} bars · {snap()!.eth.audit.gaps} gaps</span>
          <span>Last refresh: {when(updated())}</span>
        </div>
      </Show>
      <div class="research-disclaimer">Research output only. Signals use closed candles and are not orders or investment advice. Quattro's preserved signal simulation includes fees but does not model perpetual funding; TSMOM uses its historical fee/slippage assumptions. Nothing is sent to an exchange for execution.</div>
    </div>
  );
}
'''

css = r'''.research-panel{min-height:0;overflow:auto;padding:10px;gap:10px;background:var(--surface-2)}
.research-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0}
.research-toolbar strong{font-size:11px;letter-spacing:.12em;color:var(--primary)}
.research-toolbar span,.research-source{color:var(--muted);font-size:10px}
.research-source{padding:7px 9px;border:1px solid var(--border);border-radius:5px}
.research-error{padding:9px;border:1px solid #7d4b43;background:#241614;color:#f0a49a;border-radius:5px}
.research-empty{padding:20px;text-align:center;color:var(--muted)}
.research-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.research-card{min-width:0;border:1px solid var(--border);background:var(--surface);border-radius:7px;padding:11px}
.research-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.research-card small{font-size:9px;letter-spacing:.08em;color:var(--muted)}
.research-card h3{font-size:13px;margin:3px 0 0}
.research-card header>b{font-size:10px;padding:4px 7px;border-radius:4px;background:#202820;color:#b9c7ba}
.research-card header>.research-long{background:#173322;color:#8fe2aa}
.research-card header>.research-flat{background:#202820;color:#b9c7ba}
.research-card header>.research-wait{background:#332b1a;color:#e8c878}
.research-event{margin:10px 0;padding:8px;background:#0b110d;border:1px solid var(--border);border-radius:4px;font-weight:650;color:var(--text);min-height:34px}
.research-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.research-metrics>div{min-width:0;display:flex;flex-direction:column;gap:3px;padding:7px;background:var(--surface-2);border-radius:4px}
.research-metrics span{font-size:9px;color:var(--muted)}
.research-metrics b{font-size:11px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.research-card p{font-size:10px;color:var(--muted);line-height:1.5;margin:9px 0 0}
.research-quality{display:flex;flex-wrap:wrap;gap:8px 14px;padding:9px;border:1px solid var(--border);border-radius:5px;color:var(--muted);font-size:10px}
.research-quality strong{color:var(--primary);letter-spacing:.08em}
.research-disclaimer{font-size:10px;color:var(--muted);line-height:1.5;padding:4px 1px}
@media(max-width:900px){.research-grid{grid-template-columns:1fr}}
@media(max-width:520px){.research-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.research-toolbar{align-items:flex-start;flex-direction:column}}
'''

(web / "src/panels/ResearchPanel.tsx").write_text(panel, encoding="utf-8")
(web / "src/panels/research.css").write_text(css, encoding="utf-8")

# Make the built-in exchange-independent simulator unmistakably a paper account.
replace("src/app/App.tsx", "<span>{tl('Training')}</span>", "<span>{tl('Paper Trading')}</span>")
replace("src/workspace/Layout.tsx", "{tl('Training')}", "{tl('Paper Trading')}")
replace("src/training/Training.tsx", "{tl('Training')}", "{tl('Paper Trading')}")

# Keep upstream workspace regression expectations in step with the Research Lab default tab.
replace("src/workspace/model.test.ts",
"['alerts', 'watchlist', 'flow', 'signals']",
"['alerts', 'watchlist', 'flow', 'signals', 'research']")
replace("src/workspace/model.test.ts",
"['watchlist', 'flow', 'signals', 'alerts']",
"['watchlist', 'flow', 'signals', 'research', 'alerts']")
replace("src/workspace/model.test.ts",
"['watchlist', 'values', 'flow', 'signals', 'alerts']",
"['watchlist', 'values', 'flow', 'signals', 'research', 'alerts']")

# For Binance, build chart weeks from seven complete UTC daily candles, never exchange-native weekly bars.
replace("src/engine/intervals.ts",
"export function restInterval(venue: Venue, interval: string): string {\n  if (serves(venue, interval)) return interval;",
"export function restInterval(venue: Venue, interval: string): string {\n  if (interval === '1w' && (venue === 'binance-spot' || venue === 'binance-perp')) return '1d';\n  if (serves(venue, interval)) return interval;")
interval_test = '''import { restInterval } from './intervals.ts';

Deno.test('Binance weekly candles are folded from daily UTC history', () => {
  if (restInterval('binance-spot', '1w') !== '1d') throw new Error('Binance Spot weekly must be derived from daily bars');
  if (restInterval('binance-perp', '1w') !== '1d') throw new Error('Binance Perpetual weekly must be derived from daily bars');
});
'''
(web / "src/engine/intervals.test.ts").write_text(interval_test, encoding="utf-8")

# Add a first-class Research Lab panel to the existing terminal workspace.
replace("src/workspace/model.ts",
"export type PanelType = 'chart' | 'watchlist' | 'tpo' | 'values' | 'liquidations' | 'flow' | 'signals' | 'alerts' | 'dom' | 'tape' | 'econ' | 'trade' | 'positions';",
"export type PanelType = 'chart' | 'watchlist' | 'tpo' | 'values' | 'liquidations' | 'flow' | 'signals' | 'alerts' | 'dom' | 'tape' | 'econ' | 'trade' | 'positions' | 'research';")
replace("src/workspace/model.ts",
"export const PANEL_TYPES: readonly PanelType[] = ['chart', 'watchlist', 'tpo', 'values', 'dom', 'tape', 'liquidations', 'flow', 'signals', 'alerts', 'econ'];",
"export const PANEL_TYPES: readonly PanelType[] = ['chart', 'watchlist', 'tpo', 'values', 'dom', 'tape', 'liquidations', 'flow', 'signals', 'alerts', 'econ', 'research'];")
replace("src/workspace/model.ts",
"export const PANEL_TITLE: Record<PanelType, string> = { chart: 'Chart', watchlist: 'Watchlist', tpo: 'TPO', values: 'Values', liquidations: 'Liquidations', flow: 'Flow', signals: 'Signal', alerts: 'Alerts', dom: 'DOM', tape: 'Tape', econ: 'US Economic Calendar', trade: 'Trade · Testnet', positions: 'Positions · Testnet' };",
"export const PANEL_TITLE: Record<PanelType, string> = { chart: 'Chart', watchlist: 'Watchlist', tpo: 'TPO', values: 'Values', liquidations: 'Liquidations', flow: 'Flow', signals: 'Signal', alerts: 'Alerts', dom: 'DOM', tape: 'Tape', econ: 'US Economic Calendar', trade: 'Trade · Disabled', positions: 'Positions · Disabled', research: 'Research Lab' };")
replace("src/workspace/model.ts",
"export interface TradePanelState extends PanelBase {",
"export interface ResearchPanelState extends PanelBase {\n  type: 'research';\n}\n\nexport interface TradePanelState extends PanelBase {")
replace("src/workspace/model.ts",
"export type Panel = ChartPanelState | WatchlistPanelState | ValuesPanelState | LiquidationsPanelState | FlowPanelState | SignalsPanelState | AlertsPanelState | DomPanelState | TapePanelState | EconPanelState | TradePanelState | PositionsPanelState;",
"export type Panel = ChartPanelState | WatchlistPanelState | ValuesPanelState | LiquidationsPanelState | FlowPanelState | SignalsPanelState | AlertsPanelState | DomPanelState | TapePanelState | EconPanelState | ResearchPanelState | TradePanelState | PositionsPanelState;")
replace("src/workspace/model.ts",
"    case 'econ':\n      return { ...base, type, scope: 'all' };",
"    case 'econ':\n      return { ...base, type, scope: 'all' };\n    case 'research':\n      return { ...base, type };")
replace("src/workspace/model.ts",
"  const alerts = newPanel('alerts', group);\n  const liquidations = newPanel('liquidations', group);",
"  const alerts = newPanel('alerts', group);\n  const research = newPanel('research', group);\n  const liquidations = newPanel('liquidations', group);")
replace("src/workspace/model.ts",
"tabsFor(watchlist, flow, signals, alerts)",
"tabsFor(watchlist, flow, signals, alerts, research)")
replace("src/workspace/model.ts",
"[chart, tpo, values, watchlist, flow, signals, alerts, liquidations].map((p) => [p.id, p])",
"[chart, tpo, values, watchlist, flow, signals, alerts, research, liquidations].map((p) => [p.id, p])")

replace("src/workspace/Layout.tsx",
"const EconPanel = lazy(() => import('../panels/EconPanel').then((m) => ({ default: m.EconPanel })));",
"const EconPanel = lazy(() => import('../panels/EconPanel').then((m) => ({ default: m.EconPanel })));\nconst ResearchPanel = lazy(() => import('../panels/ResearchPanel').then((m) => ({ default: m.ResearchPanel })));")
replace("src/workspace/Layout.tsx",
"  if (p.type === 'watchlist') return 'Watchlist';",
"  if (p.type === 'watchlist') return 'Watchlist';\n  if (p.type === 'research') return 'Research Lab';")
replace("src/workspace/Layout.tsx",
"    case 'econ':\n      return <EconPanel panel={p} />;",
"    case 'econ':\n      return <EconPanel panel={p} />;\n    case 'research':\n      return <ResearchPanel panel={p} />;")

replace("src/app/App.tsx",
"  if (focus && focus.type !== 'watchlist') {",
"  if (focus && focus.type !== 'watchlist' && focus.type !== 'research') {")
