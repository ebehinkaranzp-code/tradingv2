import { createSignal, For, onMount, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { computeMomentum, computeQuattro } from './strategy-engine';
import './research.css';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number; closeTime: number };
type Result = { name: string; status: string; detail: string; bars: number; lastTime: number; ok: boolean };
const DAY = 86_400_000;
const fmt = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const stamp = (n: number) => new Date(n).toISOString().slice(0, 16).replace('T', ' UTC ');
const intervalMs = (i: string) => i === '4h' ? 14_400_000 : DAY;

async function fetchPage(base: string, symbol: string, interval: string, limit: number, endTime?: number): Promise<Candle[]> {
  const u = new URL(base);
  u.searchParams.set('symbol', symbol);
  u.searchParams.set('interval', interval);
  u.searchParams.set('limit', String(limit));
  if (endTime !== undefined) u.searchParams.set('endTime', String(endTime));
  const r = await fetch(u);
  if (!r.ok) throw new Error(symbol + ' ' + interval + ': HTTP ' + r.status);
  const rows = await r.json() as unknown[][];
  return rows.map(k => ({ time: Number(k[0]), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]), closeTime: Number(k[6]) }));
}

async function history(base: string, symbol: string, interval: string, needed: number): Promise<Candle[]> {
  const step = intervalMs(interval);
  let rows = await fetchPage(base, symbol, interval, Math.min(1000, needed));
  while (rows.length < needed && rows.length) {
    const older = await fetchPage(base, symbol, interval, Math.min(1000, needed - rows.length), rows[0].time - 1);
    if (!older.length) break;
    rows = older.concat(rows);
  }
  const now = Date.now();
  const byTime = new Map<number, Candle>();
  rows.forEach(c => {
    if ([c.time, c.open, c.high, c.low, c.close, c.volume, c.closeTime].every(Number.isFinite) &&
      c.open > 0 && c.low > 0 && c.high >= Math.max(c.open, c.close, c.low) &&
      c.low <= Math.min(c.open, c.close) && c.volume >= 0 && c.closeTime < now) byTime.set(c.time, c);
  });
  const out = [...byTime.values()].sort((a, b) => a.time - b.time);
  if (out.length < needed) throw new Error(symbol + ' ' + interval + ': only ' + out.length + ' closed valid candles; need ' + needed);
  const selected = out.slice(-needed);
  for (let i = 1; i < selected.length; i++) if (selected[i].time - selected[i - 1].time !== step) throw new Error(symbol + ' ' + interval + ': history gap detected; refusing to calculate');
  return selected;
}

function App() {
  const [loading, setLoading] = createSignal(false);
  const [lastRun, setLastRun] = createSignal('');
  const [error, setError] = createSignal('');
  const [results, setResults] = createSignal<Result[]>([]);
  const [quattro, setQuattro] = createSignal<Record<string, unknown> | null>(null);
  const [momentum, setMomentum] = createSignal<Record<string, unknown>[]>([]);

  const run = async () => {
    setLoading(true); setError(''); setResults([]); setQuattro(null); setMomentum([]);
    try {
      const perpBase = 'https://fapi.binance.com/fapi/v1/klines';
      const spotBase = 'https://data-api.binance.vision/api/v3/klines';
      const [four, dailyPerp] = await Promise.all([
        history(perpBase, 'BTCUSDT', '4h', 100),
        history(perpBase, 'BTCUSDT', '1d', 250),
      ]);
      if (four.length < 40 || dailyPerp.length < 220) throw new Error('Quattro requires at least 40 continuous 4H and 220 continuous daily perpetual candles.');
      const q = computeQuattro(four.map(({closeTime, ...c}) => c), dailyPerp.map(({closeTime, ...c}) => c)) as Record<string, unknown>;
      setQuattro(q);
      const qStatus = String(q.status ?? '—');
      setResults(old => [...old, { name: 'Quattro Donchian v2 · BTC Perpetual', status: qStatus, detail: '4H ' + four.length + ' closed bars · Daily ' + dailyPerp.length + ' closed bars · ' + (q.action ? String((q.action as Record<string, unknown>).action) : 'No new event') + ' · price ' + fmt(Number(q.price)), bars: four.length, lastTime: four[four.length - 1].time, ok: true }]);

      const outputs: Record<string, unknown>[] = [];
      for (const asset of ['BTC', 'ETH']) {
        try {
          const daily = await history(spotBase, asset + 'USDT', '1d', 1500);
          const r = computeMomentum(daily.map(({closeTime, ...c}) => c), asset) as Record<string, unknown>;
          outputs.push({ asset, ...r });
          setResults(old => [...old, { name: 'TSMOM + Volatility Targeting · ' + asset, status: String(r.status ?? '—'), detail: 'Exposure ' + (Number(r.exposure) * 100).toFixed(1) + '% · Lookback ' + r.lookback + ' days · Training Sharpe ' + Number(r.trainingSharpe).toFixed(2) + ' · ' + daily.length + ' closed daily bars', bars: daily.length, lastTime: daily[daily.length - 1].time, ok: true }]);
        } catch (e) {
          outputs.push({ asset, error: e instanceof Error ? e.message : String(e) });
          setResults(old => [...old, { name: 'TSMOM + Volatility Targeting · ' + asset, status: 'Unavailable', detail: e instanceof Error ? e.message : String(e), bars: 0, lastTime: 0, ok: false }]);
        }
      }
      setMomentum(outputs);
      setLastRun(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => void run());

  return (
    <main class="research">
      <header class="research-head">
        <a class="back" href={import.meta.env.BASE_URL}>← ترمینال</a>
        <div><div class="eyebrow">TRADING V2 · RESEARCH ENGINE</div><h1>موتورهای استراتژی</h1><p>محاسبه فقط با کندل‌های بسته، معتبر و پیوسته؛ بدون ارسال سفارش واقعی</p></div>
        <button class="refresh" disabled={loading()} onClick={() => void run()}>{loading() ? 'در حال دریافت و محاسبه…' : 'به‌روزرسانی داده و محاسبه'}</button>
      </header>
      <section class="source-line"><span class="dot"></span> منابع زنده: Binance USDⓈ-M Perpetual و Binance Spot <span class="source-right">{lastRun() ? 'آخرین اجرا: ' + stamp(Date.parse(lastRun())) : 'در انتظار داده'}</span></section>
      <Show when={error()}><div class="error">{error()}</div></Show>
      <section class="results">
        <For each={results()}>{r =>
          <article class="result" classList={{failed: !r.ok}}>
            <div class="result-top"><h2>{r.name}</h2><span class="state">{r.status}</span></div>
            <p>{r.detail}</p>
            <footer>{r.bars ? r.bars + ' candles · last close ' + stamp(r.lastTime + (r.name.includes('4H') ? 14_400_000 : DAY)) : 'Insufficient or invalid history'}</footer>
          </article>
        }</For>
        <Show when={loading() && !results().length}><div class="loading">در حال بارگذاری تاریخچه واقعی بازار…</div></Show>
      </section>
      <section class="method">
        <h2>قواعد و کنترل صحت</h2>
        <ul>
          <li>Quattro: BTC Perpetual، شکست Donchian بیست‌دوره‌ای، فیلتر EMA200 روزانه، ATR و حد ضرر؛ حداقل ۴۰ کندل ۴ساعته و ۲۲۰ کندل روزانه.</li>
          <li>TSMOM: BTC و ETH Spot، انتخاب lookback با walk-forward، آموزش سه‌ساله و آزمون شش‌ماهه؛ حداقل ۱٬۵۰۰ کندل روزانه.</li>
          <li>کندل جاری حذف می‌شود. داده نامعتبر یا فاصله زمانی باعث توقف محاسبه می‌شود، نه پرکردن ساختگی.</li>
          <li>کارمزد و لغزش طبق فرض‌های موتور محاسبه می‌شوند؛ funding در موتور Quattro فعلاً لحاظ نشده است.</li>
          <li>خروجی‌ها پژوهشی و شبیه‌سازی‌اند؛ توصیه مالی یا اجرای معامله نیستند.</li>
        </ul>
      </section>
    </main>
  );
}

render(() => <App />, document.getElementById('research')!);
