import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from research_btc import fit_logistic,predict,make_features
class Tests(unittest.TestCase):
 def test_logistic_separable(self):
  x=[[-2.],[-1.],[1.],[2.]]*20;y=[0,0,1,1]*20;m=fit_logistic(x,y,epochs=800)
  self.assertLess(predict(m,[-2]),.2);self.assertGreater(predict(m,[2]),.8)
 def test_features_do_not_read_future(self):
  b=[{"time":i,"open":100+i*.1,"high":102+i*.1,"low":99+i*.1,"close":101+i*.1,"volume":100+i} for i in range(260)]
  x=make_features(b);b[-1]=dict(b[-1],close=b[-1]["close"]*3);y=make_features(b)
  self.assertEqual(x[-2],y[-2]);self.assertNotEqual(x[-1],y[-1])
 def test_feature_count(self):
  b=[{"time":i,"open":100+i,"high":102+i,"low":99+i,"close":101+i,"volume":100} for i in range(250)]
  self.assertEqual(len(make_features(b)[-1]),15)
if __name__=="__main__":unittest.main()
