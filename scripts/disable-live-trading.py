#!/usr/bin/env python3
"""Apply Trading V2's research-only safety profile to the pinned Tradoor source."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "tradoor-source/web")

def replace(path: str, old: str, new: str) -> None:
    p = root / path
    source = p.read_text(encoding="utf-8")
    if old not in source:
        if new and new in source:
            return
        if not new:
            return
        raise SystemExit(f"Expected source section not found in {p}: {old[:90]!r}")
    p.write_text(source.replace(old, new, 1), encoding="utf-8")

# Remove live-trading panels independent of the upstream panel ordering.
model = root / "src/workspace/model.ts"
model_source = model.read_text(encoding="utf-8")
import re
panel_match = re.search(r"export const PANEL_TYPES: readonly PanelType\[\] = \[(.*?)\];", model_source, re.S)
if not panel_match:
    raise SystemExit(f"Could not locate PANEL_TYPES in {model}")
panel_items = [item.strip() for item in panel_match.group(1).split(",") if item.strip()]
safe_items = [item for item in panel_items if item.strip("'\\\"") not in {"trade", "positions"}]
if safe_items != panel_items:
    model_source = model_source[:panel_match.start(1)] + " ".join(safe_items) + model_source[panel_match.end(1):]
    model.write_text(model_source, encoding="utf-8")
replace("src/workspace/Layout.tsx", "const Trading = lazy(() => import('../panels/trading'));\n", "")
replace("src/workspace/Layout.tsx",
"    case 'trade':\n    case 'positions':\n      return <Trading panel={p} />;",
"    case 'trade':\n    case 'positions':\n      return <div class=\"panelcol\"><div class=\"empty\">Live exchange trading is disabled in this research terminal.</div></div>;")
replace("src/components/Settings.tsx",
"  // Signed in with Telegram only: an account to keep the trading accounts with.\n  { id: 'trading', label: 'Trading accounts', icon: 'layers' },\n", "")
replace("src/components/Settings.tsx",
"/** The trading accounts, loaded with the order system the first time they are opened. */\nconst TradingSettings = lazy(() => import('../trade/TradingSettings'));\n/** Trading accounts are for those signed in with Telegram; a local build, with no bot to sign in through, opens them as is. */\nconst tradingOpen = () => import.meta.env.DEV || !!session();\n", "")
replace("src/components/Settings.tsx",
"            <Show when={section() === 'trading'}>\n              <Show when={tradingOpen()} fallback={<p class=\"dim\">{tl('Sign in with Telegram (Account, above) to add trading accounts.')}</p>}>\n                <TradingSettings />\n              </Show>\n            </Show>\n", "")

replace(
    "src/components/Settings.tsx",
    "SECTIONS.filter((s) => s.id !== 'trading' || tradingOpen())",
    "SECTIONS.filter((s) => s.id !== 'trading')",
)

client = root / "src/trade/client.ts"
source = client.read_text(encoding="utf-8")
start = source.index("// ---- connecting")
end = source.index("// ---- following", start)
replacement = """// ---- research-only safety boundary ------------------------------------------
// Trading V2 is an analysis and simulation product. No exchange account,
// signing key, order, cancel, leverage, exit, or algo action may be initiated.
const LIVE_TRADING_DISABLED = 'Live exchange trading is disabled in Trading V2. Use the local paper simulator.';
const disabled = (): Promise<never> => Promise.reject(new Error(LIVE_TRADING_DISABLED));
export async function connectHyperliquid(_network: Network, _days: number, _label: string, _walletId?: string): Promise<string | null> { return LIVE_TRADING_DISABLED; }
export async function connectLighter(_network: Network, _label: string, _apiKeyIndex: number, _accountIndex = 0, _walletId?: string): Promise<string | null> { return LIVE_TRADING_DISABLED; }
export const importKey = (_o: { venue: Venue; network: Network; owner: string; label: string; key: string; accountIndex?: number; apiKeyIndex?: number }) => disabled();
export const addWatch = (_o: { venue: Venue; network: Network; owner: string; label: string; accountIndex?: number }) => disabled();
export const rename = (_account: string, _label: string) => disabled();
export const remove = (_account: string) => disabled();
export const removeAll = () => disabled();
export const unlock = (_passphrase: string) => disabled();
export const lock = () => Promise.resolve(null);
export const setPassphrase = (_passphrase: string, _autoLock: number) => disabled();
export const clearPassphrase = () => disabled();
export function setGuards(g: Guards): void {
  setGuardsSignal(g);
  writePref(GUARDS_KEY, JSON.stringify(g));
}
// Every order-capable action rejects before a worker or network call.
export const order = (_account: string, _req: Omit<OrderRequest, 'guards'>) => disabled();
export const cancel = (_account: string, _orders: { coin: string; oid: number }[]) => disabled();
export const move = (_account: string, _o: OpenOrder, _price: number) => disabled();
export const leverage = (_account: string, _coin: string, _lev: number, _cross: boolean) => disabled();
export const exits = (_account: string, _coin: string, _tp: number | null, _sl: number | null) => disabled();
export const flatten = (_account: string | null, _coin: string | null) => disabled();
export const runAlgo = (_spec: AlgoSpec) => disabled();
export const stopAlgo = (_algo: string) => disabled();
export const history = async (_account: string): Promise<PastOrder[]> => [];
"""
client.write_text(source[:start] + replacement + source[end:], encoding="utf-8")
