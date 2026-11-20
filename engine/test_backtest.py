import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from backtest import Candle,Decision,run_backtest

class AlwaysLong:
    name="always long"
    def on_bar(self,history):
        return Decision(1.0,"test signal")

class FuturePeeker:
    name="future peeker"
    def on_bar(self,history):
        # The API deliberately supplies only a prefix; a strategy cannot index later bars.
        assert all(history[i].time<history[i+1].time for i in range(len(history)-1))
        return Decision(0.0,"flat")

def sample():
    return [Candle(i,100+i,102+i,99+i,101+i,10) for i in range(10)]

class BacktestTests(unittest.TestCase):
    def test_decision_fills_next_open_and_forces_final_close(self):
        r=run_backtest(sample(),AlwaysLong(),fee_rate=0,slippage=0)
        self.assertEqual(r["decisions"],10)
        self.assertEqual(r["trade_count"],1)
        self.assertEqual(r["trades"][0]["entry_time"],1)
        self.assertEqual(r["trades"][0]["exit_time"],9)
        self.assertGreater(r["final_equity"],r["initial_cash"])
    def test_strategy_only_gets_historical_prefix(self):
        r=run_backtest(sample(),FuturePeeker(),fee_rate=0,slippage=0)
        self.assertEqual(r["trade_count"],0)
    def test_stop_is_checked_and_logged(self):
        bars=sample()
        class StopStrategy:
            name="stop test"
            def on_bar(self,h):
                return Decision(1,"entry",stop_loss=99.5) if len(h)==1 else Decision(0,"flat")
        bars[1]=Candle(1,100,101,98,100,10)
        r=run_backtest(bars,StopStrategy(),fee_rate=0,slippage=0)
        self.assertTrue(any(t["exit_reason"]=="stop_loss" for t in r["trades"]))
    def test_reject_invalid_execution_parameters(self):
        with self.assertRaises(ValueError): run_backtest(sample(),AlwaysLong(),fee_rate=-1)
if __name__=="__main__":unittest.main()
