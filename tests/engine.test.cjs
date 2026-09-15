'use strict';
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
let assertions=0;
function ok(c,m){assert.ok(c,m);assertions++;}
const solutions=[
 [{type:'pocket',node:2,value:true},{type:'offset',node:4,value:5},{type:'offset',node:3,value:40}],
 [{type:'pocket',node:2,value:true},{type:'split',node:2,value:36}],
 [{type:'offset',node:1,value:10},{type:'split',node:1,value:52},{type:'split',node:0,value:64}]
];
const summary=[];
for(const s of E.STAGES){
 const schedule=E.schedule(s),again=E.schedule(s);assert.deepEqual(schedule,again);assertions++;
 const b=new E.Simulation(s,E.baseConfig(s),schedule),a=new E.Simulation(s,E.configFromPlan(s,solutions[s.id]),schedule);
 while(b.step()){
  a.step();ok(b.conservation()&&a.conservation(),'flow conservation at every tick');
  ok(b.generated===a.generated&&b.pedGenerated===a.pedGenerated,'identical demand at every tick');
  for(const sim of [a,b])for(const edge of sim.net.edges)for(const lane of edge.lanes){
   for(let i=0;i<lane.length;i++){const c=lane[i];ok(Number.isFinite(c.p)&&c.p>=0&&c.p<=edge.len+1,'bounded position');if(i)ok(lane[i-1].p-c.p>=E.GAP-1e-8,'no overlap within a lane');}
  }
 }
 const am=a.metrics(),bm=b.metrics(),r=E.judge(s,solutions[s.id],bm,am);
 ok(r.win,'every scene has a reachable winning solution');
 ok(am.generated===schedule.expectedCars,'all scheduled arrivals recorded');
 ok(am.generated===am.completed+am.active+am.pending,'no hidden vehicle deletion');
 for(const m of [am,bm])for(const [key,val] of Object.entries(m))if(typeof val==='number')ok(Number.isFinite(val)&&val>=0,'finite nonnegative metric '+key);
 const empty=E.evaluate(s,[]);ok(empty.improvement===0&&!empty.win,'unchanged plan must score exactly zero improvement');
 const repeated=E.evaluate(s,solutions[s.id]);assert.deepEqual(repeated.after,am);assertions++;
 // Reset really clears the network and its event ledger.
 a.reset();ok(a.active===0&&a.generated===0,'reset counts');ok(a.net.edges.every(e=>e.lanes.every(l=>l.length===0)),'reset lanes');a.finish();assert.deepEqual(a.metrics(),am);assertions++;
 // Signal safety: main and cross greens must not overlap, including offsets and flyovers.
 for(const cfg of [E.baseConfig(s),E.configFromPlan(s,solutions[s.id])])for(let j=0;j<5;j++)for(let t=0;t<180;t+=.5){const sg=E.signal(cfg,j,t);ok(!(sg.main&&sg.cross),'conflicting greens forbidden');ok(!sg.walk||sg.cross,'walking requires crossing phase');}
 summary.push({scene:s.no,baselinePersonMinutes:+bm.delay.toFixed(2),solution:solutions[s.id],improvementPercent:+r.improvement.toFixed(2),stars:r.stars,budget:r.cost,completedBefore:bm.completed*E.SAMPLE,completedAfter:am.completed*E.SAMPLE,pedestrianDeltaSeconds:+(am.pedAvg-bm.pedAvg).toFixed(2),sideDeltaSeconds:+(am.sideAvg-bm.sideAvg).toFixed(2)});
}
const s=E.STAGES[0];
for(const p of [null,{},[null],[{type:'constructor',node:0}], [{type:'__proto__',node:1}], [{type:'offset',node:0,value:NaN}], [{type:'split',node:1,value:35}], [{type:'split',node:1,value:100}], [{type:'offset',node:10,value:0}], [{type:'sync',node:-1,value:5}], [{type:'flyover',node:1,value:true}], [{type:'pocket',node:1,value:'true'}],[{type:'rightArrow',node:1,value:'true'}], Array(4).fill({type:'split',node:1,value:32}),[{type:'offset',node:1,value:5},{type:'offset',node:1,value:8}]])ok(!E.validatePlan(s,p).ok,'invalid plans rejected');
ok(!E.validatePlan(E.STAGES[1],[{type:'pocket',node:1,value:true}]).ok,'existing roads cannot be bought twice');
// A bridge is not a magic score modifier: it can improve, but its destination can still block it.
const bridgePlan=[{type:'flyover',node:2,value:true},{type:'split',node:2,value:24}];const bridge=E.evaluate(E.STAGES[1],bridgePlan);ok(bridge.win,'highway-overpass approach also has a winning solution');
ok(bridge.after.delay>0,'a bridge never eliminates all network delay');
// Exercise a deterministic range of valid plans with no infinite/negative output.
const random=E.rng(6008);let samples=0;
while(samples<60){const st=E.STAGES[samples%3],plan=[];for(let i=0;i<3;i++){const type=random()<.5?'offset':'split';plan.push({type,node:Math.floor(random()*5),value:type==='offset'?Math.floor(random()*90):24+2*Math.floor(random()*21)});}if(!E.validatePlan(st,plan).ok)continue;const r=E.evaluate(st,plan);ok(Number.isFinite(r.improvement)&&r.after.delay>=0,'random valid plan finite');ok(r.after.generated===r.before.generated,'random identical demand');samples++;}
const report={status:'PASS',assertions,randomValidPlans:samples,winningSolutions:summary,bridgeSolution:{plan:bridgePlan,improvementPercent:+bridge.improvement.toFixed(2),stars:bridge.stars,cost:bridge.cost}};
require('node:fs').writeFileSync(require('node:path').join(__dirname,'engine-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
