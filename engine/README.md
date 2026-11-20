# Trading V2 — Analysis Engine

Independent deterministic analysis module. It has no dependency on the website, UI, network, exchange credentials, local storage or order execution.

- analysis-engine.js: pure analysis library for Node.js and browsers.
- analysis-engine.test.cjs: reproducible Node.js unit tests.

## Node.js

    const engine = require('./engine/analysis-engine.js');
    const result = engine.analyze(candles, { symbol: 'BTCUSDT', interval: '4h' });
    console.log(result.state, result.strength, result.reasons);

## Browser

Load analysis-engine.js as a script and call:
window.TradingV2AnalysisEngine.analyze(candles, options)

## Method

Evaluates closed OHLCV candles using RSI, Stochastic, Williams Alligator, EMA trend, MACD, relative volume and ATR. The multi-timeframe method combines independently supplied candle arrays with configurable weights. It rejects malformed or out-of-order OHLCV rows and excludes the still-forming candle.

Important: this is a transparent rule-based engine, not a trained machine-learning model. Strength measures agreement between rules; it is not a probability of profit or a guarantee. No orders are sent. The caller must provide genuine data and the correct spot/perpetual market type.

## Tests

Run from the repository root:
node --test engine/analysis-engine.test.cjs
