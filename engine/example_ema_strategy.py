"""Example strategy: EMA crossover with an ATR stop. Copy this file to create your own."""
from backtest import Candle, Decision

class Strategy:
    name = "EMA 20/50 crossover"

    def on_bar(self, history: list[Candle]) -> Decision:
        if len(history) < 55:
            return Decision(0.0, "warmup")
        closes=[c.close for c in history]
        def ema(values, period):
            alpha=2/(period+1); value=values[0]
            for x in values[1:]: value=alpha*x+(1-alpha)*value
            return value
        fast_now=ema(closes[-80:],20); slow_now=ema(closes[-160:],50)
        fast_prev=ema(closes[-81:-1],20); slow_prev=ema(closes[-161:-1],50)
        if fast_prev<=slow_prev and fast_now>slow_now:
            return Decision(1.0,"EMA bullish crossover")
        if fast_prev>=slow_prev and fast_now<slow_now:
            return Decision(0.0,"EMA bearish crossover")
        return Decision(1.0 if fast_now>slow_now else 0.0,"EMA trend hold")
