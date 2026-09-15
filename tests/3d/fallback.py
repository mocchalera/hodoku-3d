"""Fallback/recovery/compatibility tests, intentionally denying WebGL creation.
Run: xvfb-run -a python tests/3d/fallback.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,shutil,json,base64
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/3d'
checks=[];errors=[]
def check(ok,label):
 if not ok:raise AssertionError(label)
 checks.append(label);print('PASS',label,flush=True)
def state(p):return p.evaluate('HODOKU_APP.getState()')
def loadplan(p,sid,plan):
 code='HODOKU1:'+base64.b64encode(json.dumps({'v':1,'stage':sid,'plan':plan}).encode()).decode()
 p.locator('#data').click();p.locator('#import-plan').click();p.locator('#import-code').fill(code);p.locator('#do-import').click()

shim='''<script>(function(){const get=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')return null;return get.call(this,type,...args)};
})();</script>'''
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 def new(extra=''):
  p=b.new_page(viewport={'width':1366,'height':900},reduced_motion='reduce')
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content((ROOT/'index.html').read_text().replace('<head>','<head>'+shim+extra),wait_until='load')
  p.wait_for_function('globalThis.HODOKU_APP !== undefined')
  return p
 p=new()
 check(p.evaluate('HODOKU_APP.view().renderer')=='2D fallback','WebGL denial uses actual 2D fallback')
 check(p.locator('#view-message').is_visible() and '2D' in p.locator('#view-message').inner_text(),'fallback is explicitly disclosed')
 check(not p.locator('[data-view="model"]').is_visible(),'unsupported camera controls are not offered')
 p.locator('#start').click();check(state(p)['mode']=='planning','fallback starts the game')
 p.locator('[data-tool-tab="roads"]').click();p.locator('#build-pocket').click()
 check(state(p)['budget']==24 and len(state(p)['plan'])==1,'fallback intervention uses original budget and moves')
 loadplan(p,0,json.loads((ROOT/'tests/engine-report.json').read_text())['winningSolutions'][0]['solution'])
 p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"')
 check(state(p)['result']['win'],'fallback can complete a stage without WebGL')
 p.locator('#retry').click()
 # Compatibility of the unmodified audio, import and keyboard interfaces.
 previous=state(p)['plan'];p.locator('#data').click();p.locator('#import-plan').click();p.locator('#import-code').fill('invalid-code');p.locator('#do-import').click()
 check(state(p)['plan']==previous,'invalid imported code cannot mutate the plan')
 p.locator('.modal-close').click();p.locator('#sound').click()
 check(p.locator('#sound').get_attribute('aria-pressed')=='true','opt-in local audio still starts')
 p.locator('#sound').click();check(p.locator('#sound').get_attribute('aria-pressed')=='false','sound can be muted')
 p.locator('body').evaluate('(el)=>{el.tabIndex=-1;el.focus()}');p.keyboard.press('5');check(state(p)['selected']==4,'keyboard junction controls remain available')
 p.keyboard.press('Space');check(state(p)['paused'],'keyboard pause remains available')
 p.locator('#help').click();check(p.locator('#modal').evaluate('(el)=>el.open'),'updated help is available')
 p.keyboard.press('Escape');check(not p.locator('#modal').evaluate('(el)=>el.open'),'help closes with Escape')
 # Verify all scenes and the new shareable right-arrow strategy through UI.
 for sid in [1,2]:
  loadplan(p,sid,json.loads((ROOT/'tests/engine-report.json').read_text())['winningSolutions'][sid]['solution'])
  p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"')
  check(state(p)['result']['win'] and state(p)['conservation'],f'stage {sid+1} completes with agent conservation')
  p.locator('#retry').click()
 loadplan(p,1,[{'type':'rightArrow','node':2,'value':True}])
 check(state(p)['plan'][0]['type']=='rightArrow','right-arrow share code restores action')
 p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"')
 check(state(p)['result']['win'],'right-arrow-only plan wins stage 2')
 p.close()
 # In-memory Storage seam: not evidence of disk-backed persistence.
 saved={'hodoku-v1':json.dumps({'plans':[[{'type':'pocket','node':1,'value':True}],[],[]],'best':{},'last':0})}
 storage='<script>globalThis.testStorage='+json.dumps(saved)+';Object.defineProperty(globalThis,"localStorage",{value:{getItem(k){return testStorage[k]??null},setItem(k,v){testStorage[k]=String(v)}}});</script>'
 p=new(storage);p.locator('#start').click()
 check(state(p)['budget']==24 and len(state(p)['plan'])==1,'existing v1 plan is restored without migration')
 p.locator('#clear-plan').click();check(not json.loads(p.evaluate('testStorage["hodoku-v1"]'))['plans'][0],'changes serialize using the compatible storage key')
 p.close();b.close()
check(not errors,'no uncaught JavaScript errors in fallback or compatibility paths')
report={'status':'PASS','checks':len(checks),'cases':checks,'errors':errors,'conditions':'Chromium, native 2D fallback with WebGL initialization intentionally denied; set_content; in-memory Storage seam','limitations':['Not a physical WebGL-loss or Safari test','Disk-backed Storage not tested']}
(OUT/'fallback-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('COMPLETE',len(checks),flush=True)
