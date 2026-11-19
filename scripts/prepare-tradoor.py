#!/usr/bin/env python3
"""Apply the Trading V2 deployment policy to the pinned Tradoor source tree.

The upstream source remains unmodified in Git history; this deterministic patch
is versioned here so the exact network-facing build can be reproduced.
"""
from pathlib import Path

ROOT = Path("vendor/tradoor")

def edit(path, replacements):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in s:
            raise SystemExit(f"Expected upstream anchor missing in {path}: {old[:100]!r}")
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")

edit("web/vite.config.ts", [
    ("export default defineConfig({\n", "export default defineConfig({\n  base: process.env.VITE_BASE ?? '/',\n"),
])

edit("web/src/workspace/model.ts", [
    ("export const PANEL_TYPES: readonly PanelType[] = ['chart', 'watchlist', 'tpo', 'values', 'dom', 'tape', 'trade', 'positions', 'liquidations', 'flow', 'signals', 'alerts', 'econ'];",
     "export const PANEL_TYPES: readonly PanelType[] = ['chart', 'watchlist', 'tpo', 'values', 'dom', 'tape', 'liquidations', 'flow', 'signals', 'alerts', 'econ'];"),
])

edit("web/src/trade/present.ts", [
    ("import { createSignal } from 'solid-js';\nimport { readJson } from '../lib/prefs';\n\n// How many accounts the client last counted in this browser.\nconst [tradeOn, setTradeOn] = createSignal(Number(readJson('tradeAccounts')) > 0);\nexport { setTradeOn, tradeOn };",
     "// Trading V2 is an analysis and simulation terminal: no exchange account can enable order entry.\nexport const tradeOn = () => false;\nexport const setTradeOn = (_enabled: boolean): void => {};"),
])

edit("web/src/components/StrategyTester.tsx", [
    ("import { createMemo, createSignal, For, lazy, onCleanup, Show, Switch } from 'solid-js';",
     "import { createMemo, createSignal, For, onCleanup, Show, Switch } from 'solid-js';"),
    ("/** Live trading of the strategy: in the order system, loaded only when opened. */\nconst StrategyLive = lazy(() => import('../trade/StrategyLive').then((m) => ({ default: m.StrategyLive })));\n\n", ""),
    ("  const [liveOpen, setLiveOpen] = createSignal(false);\n", ""),
    ("        <button class=\"tb bt-live\" classList={{ on: liveOpen() }} data-tip=\"Trade this strategy on an account as its bars close\" onClick={() => setLiveOpen(!liveOpen())}>\n          Live\n        </button>\n", ""),
    ("      <Show when={liveOpen()}>\n        <StrategyLive market={props.market} timeframe={props.timeframe} onOn={() => !props.state.alerts && props.onChange({ alerts: true })} />\n      </Show>\n", ""),
])

edit("web/src/trade/client.ts", [
    ("const err = async (p: Promise<{ error: string | null }>) => (await p).error;",
     "const err = async (p: Promise<{ error: string | null }>) => (await p).error;\nconst PAPER_ONLY = 'Live exchange trading is disabled in Trading V2. Use the paper-trading simulator.';"),
    ("export async function connectHyperliquid(network: Network, days: number, label: string, walletId?: string): Promise<string | null> {\n",
     "export async function connectHyperliquid(network: Network, days: number, label: string, walletId?: string): Promise<string | null> {\n  return PAPER_ONLY;\n"),
    ("export async function connectLighter(network: Network, label: string, apiKeyIndex: number, accountIndex = 0, walletId?: string): Promise<string | null> {\n",
     "export async function connectLighter(network: Network, label: string, apiKeyIndex: number, accountIndex = 0, walletId?: string): Promise<string | null> {\n  return PAPER_ONLY;\n"),
    ("export const order = (account: string, req: Omit<OrderRequest, 'guards'>) => err(ask((id) => ({ t: 'order', id, account, req: { ...req, guards: guards() } })));",
     "export const order = async (_account: string, _req: Omit<OrderRequest, 'guards'>): Promise<string> => PAPER_ONLY;"),
    ("export const cancel = (account: string, orders: { coin: string; oid: number }[]) => err(ask((id) => ({ t: 'cancel', id, account, orders })));",
     "export const cancel = async (_account: string, _orders: { coin: string; oid: number }[]): Promise<string> => PAPER_ONLY;"),
    ("export const move = (account: string, o: OpenOrder, price: number) => err(ask((id) => ({ t: 'move', id, account, order: o, price })));",
     "export const move = async (_account: string, _o: OpenOrder, _price: number): Promise<string> => PAPER_ONLY;"),
    ("export const leverage = (account: string, coin: string, lev: number, cross: boolean) => err(ask((id) => ({ t: 'leverage', id, account, coin, leverage: lev, cross })));",
     "export const leverage = async (_account: string, _coin: string, _lev: number, _cross: boolean): Promise<string> => PAPER_ONLY;"),
    ("export const exits = (account: string, coin: string, tp: number | null, sl: number | null) => err(ask((id) => ({ t: 'exits', id, account, coin, tp, sl })));",
     "export const exits = async (_account: string, _coin: string, _tp: number | null, _sl: number | null): Promise<string> => PAPER_ONLY;"),
    ("export const flatten = (account: string | null, coin: string | null) => err(ask((id) => ({ t: 'flatten', id, account, coin, guards: guards() })));",
     "export const flatten = async (_account: string | null, _coin: string | null): Promise<string> => PAPER_ONLY;"),
    ("export const runAlgo = (spec: AlgoSpec) => err(ask((id) => ({ t: 'algo', id, spec, guards: guards() })));",
     "export const runAlgo = async (_spec: AlgoSpec): Promise<string> => PAPER_ONLY;"),
])

edit("web/src/lib/catalog-wire.ts", [
    ("export function listing(): Promise<Listing> {\n  if (held && Date.now() - held.at < 30 * 60_000) return held.value;\n  const value = read('/api/catalog', {})\n    .then((res) => {\n      if (!res.ok) throw new Error(`the catalogue answered ${res.status}`);\n      return res.json() as Promise<Wire>;\n    })\n    .then(readWire);",
     """async function staticListing(): Promise<Listing> {
  type ExchangeInfo = { symbols: { symbol: string; status: string; baseAsset: string; quoteAsset: string; filters: { filterType: string; tickSize?: string }[]; isSpotTradingAllowed?: boolean; contractType?: string }[] };
  type Ticker = { symbol: string; quoteVolume: string; lastPrice: string; priceChangePercent: string };
  const products: Listed[] = [];
  const venues: VenueStatus[] = [];
  const load = async (venue: 'binance-spot' | 'binance-perp', infoUrl: string, tickerUrl: string) => {
    const [infoRes, tickerRes] = await Promise.all([fetch(infoUrl), fetch(tickerUrl)]);
    if (!infoRes.ok || !tickerRes.ok) throw new Error(venue + ' market catalogue unavailable');
    const [info, tickers] = await Promise.all([infoRes.json() as Promise<ExchangeInfo>, tickerRes.json() as Promise<Ticker[]>]);
    const bySymbol = new Map(tickers.map((t) => [t.symbol, t]));
    const rows = info.symbols.filter((m) => m.status === 'TRADING' && m.quoteAsset === 'USDT' && (venue !== 'binance-spot' || m.isSpotTradingAllowed !== false) && (venue !== 'binance-perp' || m.contractType === 'PERPETUAL'));
    for (const m of rows) {
      const t = bySymbol.get(m.symbol);
      if (!t) continue;
      const tick = m.filters.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize ?? '0.01';
      const decimals = (tick.split('.')[1] ?? '').replace(/0+$/, '').length;
      products.push({ market: venue + ':' + m.symbol, venue, symbol: m.symbol, base: m.baseAsset, quote: m.quoteAsset, kind: venue.endsWith('perp') ? 'perp' : 'spot', priceDecimals: decimals, quoteVolume24h: Number(t.quoteVolume), lastPrice: Number(t.lastPrice), changePct: Number(t.priceChangePercent) });
    }
    venues.push({ id: venue, label: venue === 'binance-spot' ? 'Binance Spot' : 'Binance Perpetual', count: rows.length, error: null });
  };
  const results = await Promise.allSettled([
    load('binance-spot', 'https://data-api.binance.vision/api/v3/exchangeInfo', 'https://data-api.binance.vision/api/v3/ticker/24hr'),
    load('binance-perp', 'https://fapi.binance.com/fapi/v1/exchangeInfo', 'https://fapi.binance.com/fapi/v1/ticker/24hr'),
  ]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') venues.push({ id: i === 0 ? 'binance-spot' : 'binance-perp', label: i === 0 ? 'Binance Spot' : 'Binance Perpetual', count: 0, error: String(r.reason) });
  });
  if (!products.length) throw new Error('No exchange market catalogue could be loaded');
  return { updatedAt: Date.now(), venues, products, byMarket: new Map(products.map((p) => [p.market, p])) };
}

export function listing(): Promise<Listing> {
  if (held && Date.now() - held.at < 30 * 60_000) return held.value;
  const onPages = location.hostname.endsWith('github.io');
  const value = onPages ? staticListing() : read('/api/catalog', {})
    .then((res) => {
      if (!res.ok) throw new Error(`the catalogue answered ${res.status}`);
      return res.json() as Promise<Wire>;
    })
    .then(readWire);""")
])
