# Legacy strategy engine port

This directory preserves the existing Trading Dashboard strategy engine as a compatibility layer while Trading V2's native strategy service is designed.

## Files

- `strategy-engine.js`: source port of the existing Quattro Donchian v2 and Momentum + Volatility Targeting calculations.
- `strategy-engine.test.cjs`: deterministic synthetic-data strategy regression tests.
- `market-data-validation.js`: fail-closed validation for closed, fresh, ordered and gap-free candles.
- `market-data-validation.test.cjs`: malformed/stale candle rejection tests.
- No historical CSV files are bundled.
- `STRATEGY-SIGNALS-2.8.1.md`: rules, assumptions and known limitations.

## Run tests

Requires Node.js 18 or newer:

```sh
node --test *.test.cjs
```

No API keys, exchange connections, external services or network access are required. The engine emits calculations only; it does not place orders. Callers should use `validateCandles` (or the validated wrappers) before passing any external candle data to the legacy engine. Supply an explicit UTC-millisecond `now` and a timeframe-specific `maxAgeMs`; do not use an implicit local clock. Gaps and unfinished candles are rejected rather than interpolated.

## Migration policy

Do not change the legacy calculations silently. First establish parity tests, then move the rules into a typed/native strategy module with explicit configuration, data-quality checks and a separate risk approval interface. Historical data must have a compatible license and auditable provenance.
