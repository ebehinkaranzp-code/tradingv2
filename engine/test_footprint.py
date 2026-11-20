import csv,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from footprint import aggregate,FEATURE_NAMES,load_candles
class FootprintTests(unittest.TestCase):
 def make_files(self):
  d=tempfile.TemporaryDirectory();root=Path(d.name);candles=root/"candles.csv"
  with candles.open("w",newline="") as f:
   w=csv.writer(f);w.writerow(["open_time","open","high","low","close","volume"]);w.writerow([0,100,102,99,101,10]);w.writerow([86400000,101,103,100,102,11])
  trades=root/"trades.csv"
  with trades.open("w",newline="") as f:
   w=csv.writer(f);w.writerow(["agg_trade_id","price","quantity","first_trade_id","last_trade_id","transact_time","is_buyer_maker"]);w.writerow([1,100,.8,1,1,1000,"false"]);w.writerow([2,101,.3,2,2,2000,"true"]);w.writerow([3,102,.4,3,3,86401000,"false"])
  return d,candles,trades
 def test_aggressor_side_and_delta(self):
  d,c,t=self.make_files()
  try:
   x=aggregate(load_candles(c),t);self.assertEqual(x[0]["buy_volume"],.8);self.assertAlmostEqual(x[0]["sell_volume"],.3);self.assertAlmostEqual(x[0]["delta_ratio"],.5/1.1);self.assertEqual(x[1]["trade_count"],1);self.assertEqual(len(x[0]["features"]),len(FEATURE_NAMES))
  finally:d.cleanup()
 def test_no_future_trade_leakage(self):
  d,c,t=self.make_files()
  try:
   first=aggregate(load_candles(c),t)
   with t.open("a",newline="") as f:csv.writer(f).writerow([4,102,9,4,4,86402000,"true"])
   second=aggregate(load_candles(c),t);self.assertEqual(first[0]["features"],second[0]["features"]);self.assertNotEqual(first[1]["features"],second[1]["features"])
  finally:d.cleanup()
if __name__=="__main__":unittest.main()
