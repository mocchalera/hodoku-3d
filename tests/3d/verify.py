"""Real WebGL end-to-end tests. Run: xvfb-run -a python tests/3d/verify.py.
Xvfb supplies the display SwiftShader needs in this container, even headless.
Network disabled. Reduced-motion setting makes camera views settle deterministically.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,base64,time,hashlib,zipfile,os,shutil
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/3d'
checks=[];errors=[];info=[]
def check(ok,label):
 if not ok:raise AssertionError(label)
 checks.append(label);print('PASS',label,flush=True)
def st(p):return p.evaluate('HODOKU_APP.getState()')
def vw(p):return p.evaluate('HODOKU_VIEW.info()')
def val(p,s,v):p.locator(s).evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))}',str(v))
def loadplan(p,stage,plan):
 code='HODOKU1:'+base64.b64encode(json.dumps({'v':1,'stage':stage,'plan':plan},separators=(',',':')).encode()).decode()
 p.locator('#data').click();p.locator('#import-plan').click();p.locator('#import-code').fill(code);p.locator('#do-import').click()
def settle(p):
 # Wait for actual WebGL frames, not a wall-clock guess on a software GPU.
 p.wait_for_function('HODOKU_VIEW && HODOKU_VIEW.frames>0')
 if p.evaluate('HODOKU_VIEW.visible'):
  frame=p.evaluate('HODOKU_VIEW.frames')
  p.wait_for_function('(f)=>!HODOKU_VIEW.visible || HODOKU_VIEW.frames>f+1',arg=frame,timeout=20000)
 p.wait_for_function('!HODOKU_VIEW.visible || Object.keys(HODOKU_VIEW.camera).every(k=>Math.abs(HODOKU_VIEW.camera[k]-HODOKU_VIEW.target[k])<.002)',timeout=20000)
 p.wait_for_timeout(100)
def shot(p,name):p.screenshot(path=str(OUT/(name+'.png')))
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 def new(w,h,touch=False):
  p=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1,reduced_motion='reduce',has_touch=touch)
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_default_timeout(15000)
  p.set_content((ROOT/'index.html').read_text(),wait_until='load');settle(p)
  return p
 p=new(1440,960)
 check('WebGL 3D' in vw(p)['renderer'],'native 3D renderer, not fallback, initializes offline')
 check(vw(p)['shadows'],'real shadow-map framebuffer is complete')
 check(vw(p)['carCount']>20,'3D traffic actors are present')
 shot(p,'cover-desktop')
 p.locator('#start').click();settle(p);p.locator('#pause').click();settle(p)
 check(st(p)['mode']=='planning','start enters the preserved planning game')
 check(not p.evaluate('document.documentElement.scrollWidth>innerWidth'),'desktop no horizontal overflow')
 check(p.locator('#run').bounding_box()['y']<960,'primary run action visible on desktop')
 check(p.locator('.node-pin').count()==5,'all five projected 3D intersection pins exist')
 shot(p,'game-desktop')
 # Actual input gestures, rather than calling the camera implementation.
 v0=vw(p)['camera'];selected=st(p)['selected'];box=p.locator('#map').bounding_box()
 p.mouse.move(box['x']+box['width']*.45,box['y']+box['height']*.64);p.mouse.down();p.mouse.move(box['x']+box['width']*.56,box['y']+box['height']*.71,steps=5);p.mouse.up();settle(p)
 check(abs(vw(p)['camera']['yaw']-v0['yaw'])>.2,'pointer drag really rotates the 3D camera')
 check(st(p)['selected']==selected,'orbit drag does not accidentally select an intersection')
 before=vw(p)['camera']['r'];p.mouse.wheel(0,-180);settle(p)
 check(vw(p)['camera']['r']<before,'mouse wheel moves camera closer')
 p.locator('#view-home').click();settle(p);check(vw(p)['mode']=='model','home resets the view')
 p.locator('#node-tabs button').nth(2).click();p.locator('#focus-node').click();settle(p)
 check(vw(p)['mode']=='focus' and vw(p)['camera']['r']<80,'selected intersection focus')
 shot(p,'focus-desktop')
 p.locator('[data-view="top"]').click();settle(p);check(vw(p)['camera']['elev']>1.5,'true overhead perspective')
 shot(p,'top-desktop')
 p.locator('[data-view="street"]').click();settle(p);check(vw(p)['camera']['elev']<.2 and vw(p)['camera']['r']<30,'low street-level view')
 shot(p,'street-desktop')
 p.locator('[data-view="follow"]').click();settle(p);check(vw(p)['followId'] is not None,'follow mode attaches to a real simulation vehicle')
 shot(p,'follow-desktop')
 check(st(p)['paused'],'camera controls do not change simulation pause state')
 check(st(p)['plan']==[] and st(p)['budget']==44,'all camera changes are free and do not change game plan')
 p.locator('#view-home').click();p.locator('#node-tabs button').nth(1).click();p.locator('[data-tool-tab="roads"]').click()
 check(p.locator('#build-flyover').is_disabled(),'stage 1 cannot buy an unaffordable overpass')
 p.locator('#build-pocket').click();check(st(p)['budget']==24 and len(st(p)['plan'])==1,'turn pocket charges one move and 20 points')
 p.locator('[data-tool-tab="timing"]').click();val(p,'#green-range',52);p.locator('#apply-split').click();val(p,'#green-range',56);p.locator('#apply-split').click()
 check(len(st(p)['plan'])==2 and st(p)['budget']==20,'editing the same signal is not charged twice')
 val(p,'#offset-range',20);p.locator('#apply-offset').click();p.locator('#node-tabs button').nth(2).click();val(p,'#green-range',44)
 check(p.locator('#apply-split').is_disabled(),'fourth move is blocked')
 p.locator('#plan-list button').last.click();check(len(st(p)['plan'])==2 and st(p)['budget']==20,'undo restores a move and budget')
 p.locator('#clear-plan').click();p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"')
 check(st(p)['result']['improvement']==0,'no intervention still produces exactly zero improvement')
 p.locator('#retry').click()
 for n,sol in enumerate(json.loads((ROOT/'tests/engine-report.json').read_text())['winningSolutions']):
  loadplan(p,n,sol['solution']);p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"')
  r=st(p)['result'];check(r['win'],f'stage {n+1} still admits a winning solution')
  check(st(p)['conservation'],f'stage {n+1} conserves cars and pedestrians')
  p.locator('#retry').click()
 # Build an actual overpass through the UI, then inspect upper and lower lanes.
 loadplan(p,1,[]);p.locator('#node-tabs button').nth(2).click();p.locator('[data-tool-tab="roads"]').click();p.locator('#build-flyover').click()
 check(st(p)['budget']==20 and len(st(p)['plan'])==1,'overpass purchase consumes 70 points and one move')
 p.locator('[data-tool-tab="timing"]').click();val(p,'#green-range',24);p.locator('#apply-split').click();p.locator('#focus-node').click();settle(p)
 check(p.evaluate('HODOKU_VIEW.lastSim.config.junctions[2].flyover'),'visible overpass is backed by real simulation config')
 p.evaluate('HODOKU_VIEW.lastSim.advance(50)');settle(p)
 check(vw(p)['elevatedCars']>0,'through vehicles genuinely have elevation on bridge ramps')
 check(p.evaluate('HODOKU_VIEW.cars.some(c=>Math.abs(c.p.slope)>.05)'), 'bridge traffic uses a real ramp pitch')
 if not st(p)['paused']:p.locator('#pause').click()
 shot(p,'bridge-focus')
 p.locator('[data-view="model"]').click();settle(p);shot(p,'bridge-model')
 p.locator('#before').click();settle(p);check(p.evaluate('!HODOKU_VIEW.lastSim.config.junctions[2].flyover'),'before view removes actual 3D overpass')
 p.locator('#before').click();settle(p);check(p.evaluate('HODOKU_VIEW.lastSim.config.junctions[2].flyover'),'after view restores actual 3D overpass')
 p.locator('[data-view="street"]').click();settle(p);shot(p,'bridge-street')
 p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"');check(st(p)['result']['win'] and st(p)['result']['cost']==74,'overpass and signal strategy still completes the game')
 shot(p,'result-bridge');p.locator('#retry').click()
 info.append(vw(p));p.close()
 for w,h in [(390,844),(320,740),(820,1180),(1366,768)]:
  p=new(w,h,w<761)
  check('WebGL 3D' in vw(p)['renderer'],f'{w}px loads genuine 3D')
  check(not p.evaluate('document.documentElement.scrollWidth>innerWidth'),f'{w}px cover fits width')
  shot(p,f'cover-{w}');p.locator('#start').click();settle(p)
  check(not p.evaluate('document.documentElement.scrollWidth>innerWidth'),f'{w}px game fits width')
  shot(p,f'game-{w}')
  if w==390:
   bb=p.locator('#map').bounding_box();x=bb['x']+bb['width']*.55;y=bb['y']+bb['height']*.58
   before=vw(p)['camera']['yaw'];cdp=p.context.new_cdp_session(p)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+48,'y':y+10,'id':1}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});settle(p)
   check(abs(vw(p)['camera']['yaw']-before)>.1,'real one-finger touch rotates camera')
   before=vw(p)['camera']['r']
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-28,'y':y,'id':1},{'x':x+28,'y':y,'id':2}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-55,'y':y,'id':1},{'x':x+55,'y':y,'id':2}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});settle(p)
   check(vw(p)['camera']['r']<before,'real two-finger pinch zooms in')
   p.locator('#view-home').click()
  if w<761:
   loadplan(p,0,json.loads((ROOT/'tests/engine-report.json').read_text())['winningSolutions'][0]['solution']);p.locator('#mobile-run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"')
   check(st(p)['result']['win'],f'{w}px mobile completes a real game')
   shot(p,f'result-{w}')
  info.append(vw(p));p.close()
 b.close()
check(not errors,'no uncaught page errors')
report={'status':'PASS','gameSha256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'checks':len(checks),'cases':checks,'errors':errors,'rendererSamples':info,'browser':'Chromium 144 on Linux / ANGLE SwiftShader with Xvfb','loading':'local inline HTML via set_content, no network dependencies','limitations':['Physical iPhone and Safari not tested','Public deployment not performed','Software renderer frame rate does not predict device GPU performance']}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('COMPLETE',len(checks),flush=True)
