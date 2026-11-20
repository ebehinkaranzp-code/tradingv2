import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from market_transition_research import CONFIGS, indicators, make_signals, weekly_bars, backtest

class MarketTransitionTests(unittest.TestCase):
    def bars(self,n=420):
        out=[]
        for i in range(n):
            c=100+i*0.2+(i%9)*0.1
            out.append({"time":1700000000000+i*86400000,"open":c-0.1,"high":c+1,"low":c-1,"close":c,"volume":1000+(i%7)*10})
        return out
    def test_exactly_15_preregistered_experiments(self):
        self.assertEqual(len(CONFIGS),15)
        self.assertEqual([x["id"] for x in CONFIGS],list(range(1,16)))
    def test_indicator_lengths(self):
        b=self.bars()
        x=indicators(b)
        self.assertTrue(all(len(v)==len(b) for v in x.values()))
    def test_no_future_leakage_in_current_signal(self):
        b=self.bars()
        before=indicators(b)
        b2=[dict(x) for x in b]
        b2[-1]["close"]*=1.8; b2[-1]["high"]*=1.8
        after=indicators(b2)
        for key in before:
            self.assertEqual(before[key][-2],after[key][-2],key)
    def test_weekly_aggregation_reduces_bars(self):
        self.assertLess(len(weekly_bars(self.bars(420))),65)
    def test_backtest_empty_signal_preserves_capital(self):
        b=self.bars()
        r=backtest(b,[False]*len(b))
        self.assertEqual(r["trades"],0)
        self.assertAlmostEqual(r["return_pct"],0.0)
    def test_signal_vector_length(self):
        b=self.bars()
        self.assertEqual(len(make_signals(b,indicators(b),CONFIGS[0])),len(b))

if __name__=="__main__": unittest.main()
