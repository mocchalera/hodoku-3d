from pathlib import Path
from playwright.sync_api import sync_playwright
import json,shutil
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'tests/behavior';errors=[];checks=[]
def check(v,s):
 assert v,s
 checks.append(s);print('PASS',s,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 p=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,reduced_motion='reduce');p.on('pageerror',lambda e:errors.append(str(e)));p.set_default_timeout(20000)
 p.set_content((ROOT/'index.html').read_text(),wait_until='load');p.wait_for_function('window.HODOKU_VIEW&&HODOKU_VIEW.frames>1');check('WebGL 3D' in p.evaluate('HODOKU_VIEW.info().renderer'),'native WebGL initialized')
 p.locator('#start').click();p.locator('#pause').click();p.locator('#focus-node').click();p.wait_for_function('HODOKU_VIEW.camera.r<80');p.evaluate('HODOKU_VIEW.lastSim.advance(20)');p.wait_for_timeout(700)
 check(p.evaluate('HODOKU_APP.getState().paused'),'paused inspection')
 p.screenshot(path=str(OUT/'red-stop.png'))
 check(p.locator('#build-right-arrow').is_visible(),'right arrow available in timing controls')
 p.locator('#build-right-arrow').click();check(p.evaluate('HODOKU_APP.getState().budget===32&&HODOKU_APP.getState().plan.length===1'),'right arrow costs 12 pt / one move')
 # App replaces lastSim on the next frame. Capture the real app simulation at an arrow.
 p.evaluate('''()=>{const s=HODOKU_VIEW.lastSim;while(!s.signalAt(1).arrow&&s.t<1100)s.step();}''');p.wait_for_timeout(800)
 p.screenshot(path=str(OUT/'right-arrow.png'))
 check(p.evaluate('HODOKU_VIEW.lastSim.signalAt(1).arrow'),'protected arrow actually lights in running engine')
 check(p.evaluate('(()=>{const s=HODOKU_VIEW.lastSim.signalAt(1);return !s.main&&!s.cross&&!s.walk})()'),'arrow has no conflicting green')
 check(p.evaluate('HODOKU_VIEW.cars.every(a=>a.color===HODOKU.carColor(a.c))'),'rendered body colours match fixed identity')
 p.locator('#build-right-arrow').click();check(p.evaluate('HODOKU_APP.getState().budget===44&&HODOKU_APP.getState().plan.length===0'),'arrow undo refunds move and budget')
 p.locator('#node-tabs button').nth(2).click();p.locator('#focus-node').click();p.evaluate('''()=>{const s=HODOKU_VIEW.lastSim;let found=false;while(!found&&s.t<1150){s.step();found=s.walking.some(p=>p.j===2&&s.t-p.depart>7)&&s.pedQueues[2].length>0;}}''');p.wait_for_timeout(600);p.screenshot(path=str(OUT/'pedestrians.png'))
 check(p.evaluate('HODOKU_VIEW.people.some(p=>p.phase==="leaving")'),'people visibly continue on far sidewalk')
 p.locator('#run').click();p.locator('#skip').click();p.wait_for_function('HODOKU_APP.getState().mode==="result"');check(p.evaluate('HODOKU_APP.getState().result.improvement===0'),'unchanged design compares identically');p.locator('#retry').click()
 check(not errors,'no browser JS errors')
 p.close()
 p=b.new_page(viewport={'width':390,'height':844},has_touch=True,device_scale_factor=1,reduced_motion='reduce');p.on('pageerror',lambda e:errors.append(str(e)));p.set_content((ROOT/'index.html').read_text(),wait_until='load');p.wait_for_function('window.HODOKU_VIEW&&HODOKU_VIEW.frames>1');p.locator('#start').click();p.locator('#pause').click();p.locator('#build-right-arrow').scroll_into_view_if_needed();p.locator('#build-right-arrow').click();p.screenshot(path=str(OUT/'mobile-controls.png'));check(p.evaluate('HODOKU_APP.getState().plan[0].type==="rightArrow"'),'mobile arrow control works');check(not p.evaluate('document.documentElement.scrollWidth>innerWidth'),'390px fits without overflow');check(not errors,'no mobile JS errors')
 b.close()
(OUT/'browser-report.json').write_text(json.dumps({'status':'PASS','checks':checks,'errors':errors},ensure_ascii=False,indent=2))
