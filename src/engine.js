/* HODOKU: deterministic, finite-storage microscopic queue simulation.
   Pure JS, no DOM, no dependencies. All demand is scheduled before a run.
   Agents outside a full network remain in the delay ledger; none are dropped.
*/
(function(root){
'use strict';
const DATA=root.HODOKU_DATA || (typeof require==='function'?require('./data.js'):null);
const DT=.5, DURATION=1200, CYCLE=90, SAMPLE=2, GAP=8;
// One geometry contract for the simulation and both renderers. Lengths here
// are diorama world units; edge positions are map units (world / scale).
const ROAD=Object.freeze({scale:.16,mainWidth:4.6,sideWidth:3.65,kerb:1.3,
 stopBar:4.25,stopThickness:.22,stopGap:.16,crossing:3.42,crossingDepth:.82,
 walkApproach:1,walkCross:6,walkLeave:14});
const PALETTE=Object.freeze(['#ece5cd','#98b4a1','#c78267','#759493','#e4dfc8']);
function carColor(car){return car.bus?'#d9ad61':PALETTE[car.id%PALETTE.length];}
function carLength(car){return (car.bus?2.01:1.18)/ROAD.scale;}
function stopPosition(edge,car){return edge.len-(ROAD.stopBar+ROAD.stopThickness/2+ROAD.stopGap)/ROAD.scale-carLength(car)/2;}
function spacing(front,back){return Math.max(GAP,(carLength(front)+carLength(back))/2+1.4);}
function movement(edge,next){if(!next||edge.j<0)return 'straight';const ax=edge.b.x-edge.a.x,ay=edge.b.y-edge.a.y,bx=next.b.x-next.a.x,by=next.b.y-next.a.y;
 if(edge.main===next.main)return 'straight';return ax*by-ay*bx>0?'right':'left';}
function pedestrianLayout(net,j){const edge=net.map[(j?'j'+(j-1):'s')+'>j'+j],dx=(edge.b.x-edge.a.x)/edge.len,dy=(edge.b.y-edge.a.y)/edge.len;
 return {edge,dx,dy,nx:-dy,ny:dx,sidewalk:(ROAD.mainWidth/2+ROAD.kerb/4)/ROAD.scale};}
function pedestrianPoint(net,j,along,across){const g=pedestrianLayout(net,j);return {x:g.edge.b.x-g.dx*along-g.dy*across,y:g.edge.b.y-g.dy*along+g.dx*across};}
function pedestrianWait(net,p,slot=0){const g=pedestrianLayout(net,p.j),side=p.id%2?1:-1;
 return pedestrianPoint(net,p.j,(ROAD.crossing+.7+slot*.55)/ROAD.scale,side*g.sidewalk);}
function pedestrianPose(net,p,t){const g=pedestrianLayout(net,p.j),side=p.id%2?1:-1,age=Math.max(0,t-p.depart),a=ROAD.walkApproach,b=ROAD.walkCross,l=ROAD.walkLeave;
 const crossStart=ROAD.crossing/ROAD.scale,start=p.start||pedestrianWait(net,p),curb=pedestrianPoint(net,p.j,crossStart,side*g.sidewalk);
 let point,phase,alpha=1;if(age<a){const u=age/a;point={x:start.x+(curb.x-start.x)*u,y:start.y+(curb.y-start.y)*u};phase='approach';}
 else if(age<a+b){const u=(age-a)/b;point=pedestrianPoint(net,p.j,crossStart,side*g.sidewalk*(1-2*u));phase='crossing';}
 else{const u=Math.min(l,age-a-b);point=pedestrianPoint(net,p.j,crossStart+u*.65/ROAD.scale,-side*g.sidewalk);phase='leaving';alpha=Math.max(0,Math.min(1,(l-u)/2));}
 return {...point,phase,alpha,age};}
function pedestrianOnRoad(p,t){const age=t-p.depart;return age>=ROAD.walkApproach&&age<ROAD.walkApproach+ROAD.walkCross;}
const POINTS=[
 {id:'s',x:38,y:598},
 {id:'j0',x:190,y:517,name:'南の入口',sub:'住宅地からの合流',label:[-30,60]},
 {id:'j1',x:372,y:443,name:'工場通り',sub:'曲がる車が列を止める',label:[-38,61]},
 {id:'j2',x:540,y:345,name:'駅へつづく道',sub:'横断する人の多い道',label:[-72,-79]},
 {id:'j3',x:741,y:276,name:'川の手前',sub:'先の詰まりがここに届く',label:[25,65]},
 {id:'j4',x:884,y:154,name:'北の出口',sub:'最後の信号が街をせき止める',label:[-85,-51]},
 {id:'n',x:1038,y:78},
 {id:'a0',x:92,y:330},{id:'b0',x:332,y:669},
 {id:'a1',x:280,y:246},{id:'b1',x:495,y:635},
 {id:'a2',x:414,y:151},{id:'b2',x:675,y:541},
 {id:'a3',x:649,y:84},{id:'b3',x:868,y:465},
 {id:'a4',x:818,y:18},{id:'b4',x:1026,y:351}
];
const BASE=[{green:46,offset:0},{green:34,offset:37},{green:50,offset:8},{green:38,offset:59},{green:48,offset:21}];
const STAGES=[
 {id:0,no:'01',name:'ひと針の朝',caption:'MORNING / A SMALL REPAIR',hour:7,station:0,budget:44,target:18,seed:194707,load:1.03,peds:1,turn:.34,side:[.14,.28,.40,.21,.13],story:'工場通りで、曲がる車が後ろの列を止めている。大きな道をつくる前に、ひとつの詰まりを見つけよう。',hint:'03 駅へつづく道も見てみよう。青なのに列が進まないときは「曲がり待ち」かもしれない。右折レーンで列を分け、前後の信号の拍も合わせてみよう。'},
 {id:1,no:'02',name:'青は、ひとりのものではない',caption:'SCHOOL HOUR / SHARED TIME',hour:8,station:1,budget:90,target:22,seed:194708,existingPockets:[1,3],baseGreens:{2:64},load:1.20,peds:2.2,turn:.20,side:[.18,.22,.66,.40,.16],story:'駅へ向かう人、学校へ歩く人。02 と 04 の右折レーンは整った。次は、誰かに偏った青の時間をほどこう。',hint:'03 駅へつづく道には、脇道の車と歩行者が集まる。主道の青だけを延ばすと、誰かの待ち時間が増える。'},
 {id:2,no:'03',name:'帰り道の余白',caption:'EVENING / FIND THE RHYTHM',hour:17,station:2,budget:28,target:14,seed:194717,existingPockets:[1,2,3],load:1.04,peds:1.3,turn:.25,side:[.24,.27,.32,.28,.20],story:'道の改良は終わった。残るのは、時間の繕い方。青の長さと、青になる順番で、帰り道に余白をつくろう。',hint:'信号の「青の長さ」と「青になる時刻」は別のもの。連動は片方向を助けるが、反対方向にも目を向けよう。'}
];
const TOOLS={
 split:{name:'青の配分',cost:4,kind:'signal'},
 offset:{name:'信号の位相',cost:3,kind:'signal'},
 pocket:{name:'右折レーン',cost:20,kind:'build'},
 rightArrow:{name:'右折専用信号',cost:12,kind:'signal'},
 flyover:{name:'高架',cost:70,kind:'build'},
 sync:{name:'青の連動',cost:14,kind:'network'}
};
function rng(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function clone(x){return JSON.parse(JSON.stringify(x));}
const mod=(n,m)=>((n%m)+m)%m;
function observed(stage){const s=DATA.stations[stage.station],h=mod(stage.hour-7,24);return {up:s.upSmall[h]+s.upLarge[h],down:s.downSmall[h]+s.downLarge[h],station:s};}
function baseConfig(stage=STAGES[0]){return {junctions:BASE.map((x,i)=>({...x,green:stage.baseGreens?.[i]??x.green,pocket:(stage.existingPockets||[]).includes(i),flyover:false,rightArrow:false})),sync:0};}
function validatePlan(stage,plan){
 if(!Array.isArray(plan)||plan.length>3)return {ok:false,reason:'変更できるのは3手までです。'};
 const keys=new Set(); let cost=0;
 for(const p of plan){
  if(!p||typeof p!=='object'||!Object.hasOwn(TOOLS,p.type))return {ok:false,reason:'知らない対策です。'};
  if(p.type!=='sync'&&(!Number.isInteger(p.node)||p.node<0||p.node>4))return {ok:false,reason:'交差点が不正です。'};
  if(p.type==='split'&&(!Number.isInteger(p.value)||p.value<24||p.value>64||p.value%2))return {ok:false,reason:'青の配分が範囲外です。'};
  if(p.type==='offset'&&(!Number.isInteger(p.value)||p.value<0||p.value>=90))return {ok:false,reason:'位相が範囲外です。'};
  if((p.type==='pocket'||p.type==='flyover'||p.type==='rightArrow')&&p.value!==true)return {ok:false,reason:'工事の設定が不正です。'};
  if(p.type==='sync'&&p.value!==1&&p.value!==-1)return {ok:false,reason:'連動の方向が不正です。'};
  if(p.type==='pocket'&&(stage.existingPockets||[]).includes(p.node))return {ok:false,reason:'ここには右折レーンが既設です。'};
  const key=p.type==='sync'?'sync':p.type+':'+p.node;
  if(keys.has(key))return {ok:false,reason:'同じ対策が重複しています。'};keys.add(key);cost+=TOOLS[p.type].cost;
 }
 if(cost>stage.budget)return {ok:false,reason:'予算が足りません。'};
 return {ok:true,cost};
}
function configFromPlan(stage,plan){
 const valid=validatePlan(stage,plan);if(!valid.ok)throw new Error(valid.reason);
 const c=baseConfig(stage);const sync=plan.find(p=>p.type==='sync');
 if(sync){c.sync=sync.value;let sum=0;let indices=sync.value===1?[0,1,2,3,4]:[4,3,2,1,0];for(let k=0;k<5;k++){const i=indices[k];if(k){const a=POINTS[indices[k-1]+1],b=POINTS[i+1];sum+=Math.hypot(b.x-a.x,b.y-a.y)/8.0;}c.junctions[i].offset=Math.round(sum)%90;}}
 for(const p of plan){if(p.type==='sync')continue;const j=c.junctions[p.node];if(p.type==='split')j.green=p.value;else if(p.type==='offset')j.offset=p.value;else j[p.type]=true;}
 return c;
}
function makeNetwork(config){
 const points=Object.fromEntries(POINTS.map(p=>[p.id,p]));const edges=[],map={};
 function add(a,b,main){const A=points[a],B=points[b],id=a+'>'+b;const j=b[0]==='j'?+b.slice(1):-1;const edge={id,from:a,to:b,a:A,b:B,len:Math.hypot(A.x-B.x,A.y-B.y),main,j,lanes:[[],[]],last:[-20,-20]};edges.push(edge);map[id]=edge;}
 const axis=['s','j0','j1','j2','j3','j4','n'];for(let i=0;i<axis.length-1;i++){add(axis[i],axis[i+1],true);add(axis[i+1],axis[i],true);}
 for(let i=0;i<5;i++){for(const side of ['a','b']){add(side+i,'j'+i,false);add('j'+i,side+i,false);}}
 return {points,edges,map};
}
function schedule(stage){
 const R=rng(stage.seed),obs=observed(stage),events=[],peds=[];let id=0,pid=0;
 const dirs=[{source:'s',dir:1,rate:obs.down},{source:'n',dir:-1,rate:obs.up}];
 function emit(rate,routeMaker,side){const count=Math.round(rate*DURATION/3600/SAMPLE);for(let i=0;i<count;i++){let t=(i+.1+R()*.8)*DURATION/count;const route=routeMaker();const bus=R()<.045;events.push({id:id++,t,route,bus,persons:SAMPLE*(bus?14:1.25),side,speed:bus?7.7:8.0+R()*.7});}}
 for(const d of dirs){emit(d.rate*stage.load,()=>{const ns=d.dir===1?[0,1,2,3,4]:[4,3,2,1,0];const route=[d.source];let exit=-1;if(R()<stage.turn*1.6)exit=ns[1+Math.floor(R()*3)];for(const i of ns){route.push('j'+i);if(i===exit){route.push((R()<.5?'a':'b')+i);return route;}}route.push(d.dir===1?'n':'s');return route;},false);}
 for(let j=0;j<5;j++)for(const s of ['a','b']){
  emit((obs.up+obs.down)*.5*stage.side[j]*stage.load,()=>{let route=[s+j,'j'+j];if(R()<.3){const dir=R()<.5?1:-1;for(let k=j+dir;k>=0&&k<5;k+=dir)route.push('j'+k);route.push(dir===1?'n':'s');}else route.push((s==='a'?'b':'a')+j);return route;},true);
 }
 for(let j=0;j<5;j++){let count=Math.round([22,28,90,45,18][j]*stage.peds);for(let i=0;i<count;i++)peds.push({id:pid++,j,t:(i+R())*DURATION/count,persons:2});}
 events.sort((a,b)=>a.t-b.t||a.id-b.id);peds.sort((a,b)=>a.t-b.t||a.id-b.id);
 return {events,peds,expectedCars:events.length,expectedPeds:peds.length};
}
function signal(config,j,t){const c=config.junctions[j],phase=mod(t-c.offset,CYCLE),mainEnd=c.green-(c.rightArrow?12:0);
 // The optional arrow borrows 12s from the MAIN allocation: 3s amber,
 // 1s clearance, 8s protected right. It never steals pedestrian clearance.
 const main=phase<mainEnd,arrow=!!c.rightArrow&&phase>=c.green-8&&phase<c.green,cross=phase>=c.green+4&&phase<CYCLE-4;
 return {phase,main,arrow,cross,turn:c.rightArrow?arrow:phase>=c.green-10&&phase<c.green,
 walk:cross&&phase<CYCLE-4-ROAD.walkApproach-ROAD.walkCross,
 mainAmber:phase>=mainEnd&&phase<mainEnd+3,crossAmber:phase>=CYCLE-4&&phase<CYCLE-1,
 green:c.green,mainEnd,held:false};}

class Simulation{
 constructor(stage,config,sharedSchedule){this.stage=stage;this.config=clone(config);this.net=makeNetwork(config);this.demand=sharedSchedule||schedule(stage);this.reset();}
 reset(){
  for(const e of this.net.edges){e.lanes=[[],[]];e.last=[-20,-20];}
  this.t=0;this.tick=0;this.eventIndex=0;this.pedIndex=0;this.pending=[];this.active=0;this.generated=0;this.completed=0;this.completedPeople=0;this.totalPeople=0;this.pedGenerated=0;this.pedCompleted=0;this.pedQueues=Array.from({length:5},()=>[]);this.walking=[];this.signals=null;this.walkLast=[-10,-10,-10,-10,-10];this.delay=0;this.vehicleDelay=0;this.sideDelay=0;this.sidePeople=0;this.busDelay=0;this.busPeople=0;this.pedDelay=0;this.pedPeople=0;this.maxQueue=0;this.maxPedWait=0;this.exitEvents=[];this.series=[];this.jStats=Array.from({length:5},()=>({delay:0,count:0,maxQueue:0}));this.lastSample=-10;
 }
 laneFor(car,edge,index){const next=this.net.map[edge.to+'>'+car.route[index+2]];return edge.main&&edge.j>=0&&this.config.junctions[edge.j].pocket&&movement(edge,next)==='right'?1:0;}
 room(edge,lane,car=null){const a=edge.lanes[lane];return !a.length||a[a.length-1].p>=(car?spacing(a[a.length-1],car):GAP)+1;}
 rightGap(edge,sg){for(const other of this.net.edges){
  if(other.j===edge.j&&other.main&&other!==edge){for(const lane of other.lanes)for(const car of lane.slice(0,1)){const next=this.net.map[other.to+'>'+car.route[car.idx+2]];if(movement(other,next)==='right')continue;
   if(car.entered||(sg.main&&(other.len-car.p)/car.speed<5.5))return false;}}
  if(other.from===edge.to)for(const lane of other.lanes)for(const car of lane)if(car.clearJ===edge.j&&car.clearKind==='main'&&car.p<(ROAD.crossing+ROAD.crossingDepth/2)/ROAD.scale+carLength(car)/2)return false;
 }return true;}
 signalAt(j){return this.signals?this.signals[j]:signal(this.config,j,this.t);}
 resolveSignals(){const busy=Array.from({length:5},()=>new Set());
  for(const e of this.net.edges)for(const lane of e.lanes)for(const c of lane){
   if(e.j>=0&&c.entered&&!c.elevated)busy[e.j].add(c.entryKind);
   if(c.clearJ>=0&&c.p<(ROAD.crossing+ROAD.crossingDepth/2)/ROAD.scale+carLength(c)/2)busy[c.clearJ].add(c.clearKind);
  }
  return this.config.junctions.map((_,j)=>{const sg=signal(this.config,j,this.t),b=busy[j],walking=this.walking.some(p=>p.j===j&&this.t-p.depart<ROAD.walkApproach+ROAD.walkCross);
   if(sg.main&&(b.has('cross')||b.has('crossTurn')||walking)){sg.main=false;sg.mainAmber=false;sg.turn=false;sg.held=true;}
   if(sg.arrow&&(b.has('main')||b.has('cross')||b.has('crossTurn')||walking)){sg.arrow=false;sg.turn=false;sg.held=true;}
   if(sg.cross&&(b.has('main')||b.has('right'))){sg.cross=false;sg.crossAmber=false;sg.walk=false;sg.held=true;}
   if(sg.walk&&b.has('crossTurn'))sg.walk=false;
   return sg;
  });
 }
 addDelay(car,dt,j=-1){if(dt<=0)return;const d=dt*car.persons;car.delay+=dt;this.delay+=d;this.vehicleDelay+=d;if(car.side)this.sideDelay+=d;if(car.bus)this.busDelay+=d;if(j>=0)this.jStats[j].delay+=d;}
 step(){
  if(this.t>=DURATION)return false;const dt=Math.min(DT,DURATION-this.t);this.t+=dt;this.tick++;this.exitEvents.length=0;
  while(this.eventIndex<this.demand.events.length&&this.demand.events[this.eventIndex].t<=this.t){const s=this.demand.events[this.eventIndex++];const car={...s,idx:0,p:0,prevP:0,delay:0,moved:-1,stopped:false,entered:false,clearJ:-1};this.pending.push(car);this.generated++;this.totalPeople+=car.persons;if(car.side)this.sidePeople+=car.persons;if(car.bus)this.busPeople+=car.persons;}
  for(let i=0;i<this.pending.length;){const car=this.pending[i],edge=this.net.map[car.route[0]+'>'+car.route[1]],lane=this.laneFor(car,edge,0);if(this.room(edge,lane,car)){car.lane=lane;edge.lanes[lane].push(car);this.active++;this.pending.splice(i,1);}else{this.addDelay(car,dt,edge.j);i++;}}
  while(this.pedIndex<this.demand.peds.length&&this.demand.peds[this.pedIndex].t<=this.t){const p={...this.demand.peds[this.pedIndex++],wait:0};this.pedQueues[p.j].push(p);this.pedGenerated++;this.pedPeople+=p.persons;}
  const signals=this.signals=this.resolveSignals();
  // Rotate edge iteration order: remove systematic direction advantage, deterministically.
  const edges=this.net.edges,start=this.tick%edges.length;
  for(let ei=0;ei<edges.length;ei++){const e=edges[(ei+start)%edges.length];
   for(let l=0;l<2;l++){const lane=e.lanes[l];let ahead=null;
    for(let i=0;i<lane.length;){const c=lane[i];if(c.moved===this.tick){ahead=c;i++;continue;}c.moved=this.tick;c.prevP=c.p;
     const nextId=c.route[c.idx+2],next=nextId?this.net.map[e.to+'>'+nextId]:null,turn=movement(e,next),right=turn==='right'&&e.main;
     const cfg=e.j>=0?this.config.junctions[e.j]:null,sg=e.j>=0?signals[e.j]:null;
     const elevated=!!(cfg&&cfg.flyover&&e.main&&next&&next.main),nextLane=next?this.laneFor(c,next,c.idx+1):0;
     const room=!next||this.room(next,nextLane,c),headway=e.main?3.4:3.8;
     let green=!sg||elevated||(e.main?(sg.main||(right&&sg.arrow)):sg.cross);
     // Pedestrians have priority over cars turning from the side road.
     const footConflict=sg&&!e.main&&next?.main&&((sg.walk&&this.pedQueues[e.j].length>0)||this.walking.some(p=>p.j===e.j&&this.t-p.depart<ROAD.walkApproach+ROAD.walkCross));
     if(footConflict)green=false;
     // Do not enter unless the WHOLE vehicle can clear the exit crosswalk.
     // A single empty car slot is not enough and can deadlock a junction.
     const tail=next?.lanes[nextLane].at(-1),clearance=(ROAD.crossing+ROAD.crossingDepth/2)/ROAD.scale+carLength(c)/2;
     const entryRoom=room&&(!tail||tail.p>=clearance+spacing(tail,c));
     const mayEnter=green&&entryRoom&&this.t-e.last[l]>=headway;
     let mayExit=c.entered||mayEnter;
     if(right&&!elevated){
      // A car that entered on green can wait IN the junction. Once the
      // opposing green ends it clears, while the conflict interlock holds red.
      const gap=sg.arrow||this.rightGap(e,sg);
      mayExit=mayExit&&gap&&(sg.turn||(c.entered&&!sg.main&&!sg.mainAmber));
     }
     if(footConflict)mayExit=false;
     mayExit=mayExit&&room;
     const stop=e.j>=0&&!elevated?stopPosition(e,c):e.len-10;
     let max=c.entered||mayEnter?(mayExit?e.len+1:e.len-10):stop;
     if(ahead)max=Math.min(max,ahead.p-spacing(ahead,c));
     const old=c.p;c.p=Math.max(old,Math.min(old+c.speed*dt,max));c.stopped=c.p-old<c.speed*dt*.2;
     if(!c.entered&&c.p>stop+1e-8&&mayEnter){c.entered=true;c.elevated=elevated;c.entryKind=e.main?(right?'right':'main'):(next?.main?'crossTurn':'cross');}
     this.addDelay(c,dt-Math.min(dt,(c.p-old)/c.speed),e.j);
     if(c.p>=e.len&&mayExit){
      e.last[l]=this.t;lane.splice(i,1);
      if(next){c.clearJ=e.j>=0&&!elevated?e.j:-1;c.clearKind=c.entryKind;c.idx++;c.p=0;c.prevP=0;c.lane=nextLane;c.entered=false;c.elevated=false;c.entryKind=null;next.lanes[nextLane].push(c);}
      else{this.active--;this.completed++;this.completedPeople+=c.persons;this.exitEvents.push(c);}
     }else{ahead=c;i++;}
    }
   }
  }
  for(let j=0;j<5;j++){const q=this.pedQueues[j];for(const p of q){p.wait+=dt;this.pedDelay+=dt*p.persons;this.delay+=dt*p.persons;this.jStats[j].delay+=dt*p.persons;this.maxPedWait=Math.max(this.maxPedWait,p.wait);}
   if(signals[j].walk&&this.t-this.walkLast[j]>=1.0){
    // One person/group per bank; a stable identity persists through the curb,
    // crossing and sidewalk departure. No deletion at the far kerb.
    for(const side of[0,1]){const index=q.findIndex(p=>p.id%2===side);if(index<0)continue;const p=q.splice(index,1)[0];this.walking.push({...p,start:pedestrianWait(this.net,p),depart:this.t,counted:false});}
    this.walkLast[j]=this.t;
   }
  }
  for(const p of this.walking)if(!p.counted&&this.t-p.depart>=ROAD.walkApproach+ROAD.walkCross){p.counted=true;this.pedCompleted++;}
  this.walking=this.walking.filter(p=>this.t-p.depart<ROAD.walkApproach+ROAD.walkCross+ROAD.walkLeave);
  if(this.t-this.lastSample>=10||this.t>=DURATION){const counts=this.queueCounts();const q=counts.reduce((a,x)=>a+x,0)+this.pending.length;this.maxQueue=Math.max(this.maxQueue,q);counts.forEach((n,j)=>this.jStats[j].maxQueue=Math.max(this.jStats[j].maxQueue,n));this.series.push({t:this.t,q,delay:this.delay/60,arrived:this.completed,queues:counts});this.lastSample=this.t;}
  return true;
 }
 queueCounts(){const a=[0,0,0,0,0];for(const e of this.net.edges)if(e.j>=0)for(const lane of e.lanes)for(const c of lane)if(c.stopped)a[e.j]++;return a;}
 finish(){while(this.step()){}return this.metrics();}
 advance(seconds){const steps=Math.floor(seconds/DT);for(let i=0;i<steps&&this.t<DURATION;i++)this.step();return this.t;}
 metrics(){return {t:this.t,delay:this.delay/60,vehicleAvg:this.vehicleDelay/Math.max(1,this.totalPeople),sideAvg:this.sideDelay/Math.max(1,this.sidePeople),busAvg:this.busDelay/Math.max(1,this.busPeople),pedAvg:this.pedDelay/Math.max(1,this.pedPeople),maxPedWait:this.maxPedWait,generated:this.generated,completed:this.completed,pending:this.pending.length,active:this.active,unfinished:this.active+this.pending.length,pedGenerated:this.pedGenerated,pedCompleted:this.pedCompleted,maxQueue:this.maxQueue,people:this.totalPeople+this.pedPeople,arrivedPeople:this.completedPeople+this.pedCompleted*2,series:this.series.map(x=>({...x})),junctions:this.jStats.map(x=>({...x}))};}
 conservation(){const live=this.net.edges.reduce((sum,e)=>sum+e.lanes[0].length+e.lanes[1].length,0);return this.active===live&&this.generated===this.completed+this.active+this.pending.length&&this.pedGenerated===this.pedCompleted+this.walking.filter(p=>!p.counted).length+this.pedQueues.reduce((a,q)=>a+q.length,0);}
}
function evaluate(stage,plan){const demand=schedule(stage);const before=new Simulation(stage,baseConfig(stage),demand).finish();const after=new Simulation(stage,configFromPlan(stage,plan),demand).finish();return judge(stage,plan,before,after);}
function judge(stage,plan,before,after){
 const cost=validatePlan(stage,plan).cost||0;const improvement=(1-after.delay/Math.max(.001,before.delay))*100;
 const pedOK=after.pedAvg<=before.pedAvg+6;const sideOK=after.sideAvg<=before.sideAvg+15;const completeOK=after.completed>=before.completed-2;
 const win=improvement>=stage.target&&pedOK&&sideOK&&completeOK;
 const economy=1-cost/stage.budget;const score=Math.max(0,Math.round(improvement*12+economy*80+(3-plan.length)*20-(pedOK?0:80)-(sideOK?0:100)));
 let stars=win?1:0;if(win&&improvement>=stage.target+8)stars++;if(win&&cost<=stage.budget*.6)stars++;
 return {before,after,improvement,pedOK,sideOK,completeOK,win,cost,score,stars,saved:before.delay-after.delay};
}
const api={DATA,ROAD,PALETTE,carColor,carLength,stopPosition,spacing,movement,pedestrianLayout,pedestrianPoint,pedestrianWait,pedestrianPose,pedestrianOnRoad,DT,DURATION,CYCLE,SAMPLE,GAP,POINTS,BASE,STAGES,TOOLS,rng,observed,baseConfig,validatePlan,configFromPlan,makeNetwork,schedule,signal,Simulation,evaluate,judge};
root.HODOKU=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
