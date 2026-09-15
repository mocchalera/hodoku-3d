'use strict';
const assert=require('node:assert/strict'),E=require('../../src/engine');
let checks=0,redStops=0,rightWaiting=0,clears=0,pedLeaving=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const configurations=[[],[{type:'rightArrow',node:1,value:true}],[{type:'pocket',node:2,value:true},{type:'rightArrow',node:2,value:true}]];
for(const st of E.STAGES)for(const plan of configurations){if(!E.validatePlan(st,plan).ok)continue;const sim=new E.Simulation(st,E.configFromPlan(st,plan));while(sim.step()){
 ok(sim.conservation(),'all vehicles and pedestrians conserved');
 for(let j=0;j<5;j++){const sg=sim.signalAt(j);ok(!(sg.main&&sg.cross),'cross/main exclusive');ok(!(sg.arrow&&(sg.main||sg.cross||sg.walk)),'protected arrow exclusive');ok(!sg.walk||sg.cross,'walk only in pedestrian phase');}
 for(const e of sim.net.edges)for(const lane of e.lanes)for(let i=0;i<lane.length;i++){
  const c=lane[i];ok(Number.isFinite(c.p)&&c.p>=0&&c.p<=e.len+1,'bounded position');if(i)ok(lane[i-1].p-c.p>=E.spacing(lane[i-1],c)-1e-8,'body-aware separation');
  if(e.j<0)continue;const next=sim.net.map[e.to+'>'+c.route[c.idx+2]],cfg=sim.config.junctions[e.j],sg=sim.signalAt(e.j),right=E.movement(e,next)==='right',bridge=cfg.flyover&&e.main&&next?.main;
  const green=e.main?(sg.main||(right&&sg.arrow)):sg.cross;
  if(!green&&!bridge&&!c.entered){ok(c.p<=E.stopPosition(e,c)+1e-8,'red vehicle front is before stop bar');if(c.stopped)redStops++;}
  if(c.entered&&right&&c.stopped)rightWaiting++;
  if(c.entered&&!green&&!c.stopped)clears++;
  ok(E.carColor({...c,stopped:true})===E.carColor({...c,stopped:false}),'body colour immutable');
 }
 for(const p of sim.walking){const pose=E.pedestrianPose(sim.net,p,sim.t);ok(Number.isFinite(pose.x)&&Number.isFinite(pose.y),'finite pedestrian position');if(pose.phase==='leaving')pedLeaving++;}
 }
 console.log('SIM PASS',st.id,plan.map(p=>p.type).join(','),sim.completed,sim.pedCompleted);
}
// Exact line cases: all 20 approaches, car and bus, arriving during a red.
for(let j=0;j<5;j++)for(const e of E.makeNetwork(E.baseConfig()).edges.filter(e=>e.j===j))for(const bus of[false,true]){
 const config=E.baseConfig();for(const c of config.junctions)c.offset=0;
 const route=[e.from,e.to,e.main?'b'+j:'a'+j];if(route[0]===route[2])route[2]='b'+j;
 const demand={events:[{id:0,t:0,route,bus,persons:1,side:!e.main,speed:8}],peds:[]};
 const sim=new E.Simulation(E.STAGES[0],config,demand);sim.t=e.main?config.junctions[j].green+5:3;
 const edge=sim.net.map[e.id];sim.step();const car=edge.lanes.flat()[0];assert.ok(car);car.p=E.stopPosition(edge,car)-.1;car.prevP=car.p;car.entered=false;sim.step();
 ok(car.p<=E.stopPosition(edge,car)+1e-8,'red stops correct for every approach/body size');
 const frontRemaining=(edge.len-car.p-E.carLength(car)/2)*E.ROAD.scale;
 ok(frontRemaining>=E.ROAD.stopBar+E.ROAD.stopThickness/2+E.ROAD.stopGap-1e-8,'bumper retains explicit line clearance');
}
// Pedestrians never wait or walk away on asphalt, irrespective of road angle.
const net=E.makeNetwork(E.baseConfig());function distance(p,e){const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,t=Math.max(0,Math.min(1,((p.x-e.a.x)*dx+(p.y-e.a.y)*dy)/e.len**2));return Math.hypot(p.x-e.a.x-dx*t,p.y-e.a.y-dy*t)*E.ROAD.scale;}
for(let j=0;j<5;j++)for(let id=0;id<2;id++){
 const p={id,j,depart:0};for(let slot=0;slot<28;slot++){const pos=E.pedestrianWait(net,p,slot);for(const edge of net.edges)ok(distance(pos,edge)>(edge.main?E.ROAD.mainWidth:E.ROAD.sideWidth)/2+.11,'waiting body on sidewalk outside ALL roads');}
 for(let t=7;t<=21;t+=.25){const pos=E.pedestrianPose(net,p,t);for(const edge of net.edges)ok(distance(pos,edge)>(edge.main?E.ROAD.mainWidth:E.ROAD.sideWidth)/2+.11,'departure stays on sidewalk');}
 // No jump at either kerb or when switching to walking away.
 for(const boundary of[1,7]){const a=E.pedestrianPose(net,p,boundary-1e-7),b=E.pedestrianPose(net,p,boundary+1e-7);ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-4,'continuous crossing boundaries');}
 ok(E.pedestrianPose(net,p,8).alpha===1,'fully visible after crossing');ok(E.pedestrianPose(net,p,20.5).alpha>0,'departing person fades only far from crossing');
}
ok(redStops>0&&rightWaiting>0&&clears>0&&pedLeaving>0,'exercised red stops, right waits, clearance and departures');
const report={status:'PASS',checks,redStops,rightWaiting,clears,pedLeaving};require('fs').writeFileSync(__dirname+'/invariants-report.json',JSON.stringify(report,null,2));console.log(report);
