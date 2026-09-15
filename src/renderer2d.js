/* A drawn atlas, not a dashboard. All graphics are local vector / canvas work. */
(function(root){
'use strict';
const E=root.HODOKU;
const C={paper:'#f3eee3',ink:'#273e3b',muted:'#748074',green:'#507361',red:'#bd553b',light:'#d9dcc9',blue:'#a4bdba',yellow:'#b9a46b'};
const FONT='"Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif';
const MONO='"SFMono-Regular",Consolas,monospace';
function path(ctx,pts){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));}
function line(ctx,pts,color,width=1){path(ctx,pts);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function poly(ctx,pts,fill,stroke){path(ctx,pts);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}}
function text(ctx,t,x,y,size=12,color=C.muted,font=FONT){ctx.font=size+'px '+font;ctx.fillStyle=color;ctx.fillText(t,x,y);}
function circle(ctx,x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function distanceSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
class Atlas{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.w=0;this.h=0;this.scale=1;this.tx=0;this.ty=0;this.background=this.makeBackground();this.resize();this.hover=-1;}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(2,root.devicePixelRatio||1);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.scale=this.w<760?this.w/945:Math.min(this.w/1100,(this.h-20)/705);this.tx=(this.w-1100*this.scale)/2;this.ty=(this.h-700*this.scale)/2+(this.w<600?48:19);}
 world(clientX,clientY){const r=this.canvas.getBoundingClientRect();return {x:(clientX-r.left-this.tx)/this.scale,y:(clientY-r.top-this.ty)/this.scale};}
 hit(clientX,clientY){const p=this.world(clientX,clientY);let id=-1,best=Infinity;for(let j=0;j<5;j++){const n=E.POINTS[j+1];const d=Math.min(Math.hypot(n.x-p.x,n.y-p.y),Math.hypot(n.x-12-p.x,n.y-34-p.y));if(d<Math.max(29,23/this.scale)&&d<best){best=d;id=j;}}return id;}
 makeBackground(){
  const canvas=document.createElement('canvas');canvas.width=1650;canvas.height=1050;const ctx=canvas.getContext('2d');ctx.scale(1.5,1.5);ctx.lineCap='round';ctx.lineJoin='round';
  const R=E.rng(79433),net=E.makeNetwork(E.baseConfig());
  // Survey registration marks, faint dots and topographic contours.
  for(let x=15;x<1100;x+=26)for(let y=15;y<700;y+=26){circle(ctx,x,y,.65,'#aeb5a12d');}
  for(let k=0;k<8;k++){ctx.beginPath();ctx.moveTo(-40,235+k*13);ctx.bezierCurveTo(90,263+k*11,122,72+k*17,204,102+k*21);ctx.bezierCurveTo(274,100+k*26,298,172+k*10,392,108+k*17);ctx.strokeStyle='#a6b09a29';ctx.lineWidth=.8;ctx.stroke();}
  // Mountains are an emblem, not a topographic reconstruction.
  poly(ctx,[[0,267],[103,148],[159,219],[219,133],[328,274]],'#dae0cc57',null);
  line(ctx,[[12,261],[102,156],[151,216],[219,141],[316,265]],'#a7b29b',1);
  line(ctx,[[76,187],[102,156],[127,188],[114,183],[103,190],[92,181],[76,187]],'#f5f1e5',2);
  line(ctx,[[187,180],[219,141],[253,185],[234,176],[220,184],[206,172],[187,180]],'#f5f1e5',2);
  circle(ctx,291,85,23,'#d8bb7d33','#b9a57066');
  text(ctx,'N O R T H E R N   A L P S',57,292,8,'#8b957e',MONO);
  // River, a strip of faded blue paper.
  const river=()=>{ctx.beginPath();ctx.moveTo(591,-35);ctx.bezierCurveTo(627,91,573,161,611,245);ctx.bezierCurveTo(651,336,698,358,745,433);ctx.bezierCurveTo(800,518,767,567,832,745);};
  river();ctx.strokeStyle='#c8d7cd';ctx.lineWidth=42;ctx.stroke();river();ctx.strokeStyle='#adc4bf';ctx.lineWidth=30;ctx.stroke();river();ctx.strokeStyle='#dce5d7';ctx.lineWidth=1;ctx.stroke();
  ctx.save();ctx.translate(730,526);ctx.rotate(1.04);text(ctx,'川 の 流 れ',0,0,10,'#648a81');ctx.restore();
  // Neighbourhood patches with drypoint-like hatch marks.
  const fields=[[[40,407],[102,373],[134,425],[67,464]],[[111,648],[195,598],[238,679],[154,727]],[[268,354],[313,325],[343,372],[300,394]],[[433,246],[480,221],[502,251],[457,276]],[[858,578],[951,522],[1007,611],[913,664]],[[905,385],[953,356],[999,417],[955,445]]];
  for(const f of fields){poly(ctx,f,'#d9ddc54d','#bec9b16b');ctx.save();path(ctx,f);ctx.closePath();ctx.clip();for(let i=-700;i<1800;i+=8)line(ctx,[[i,0],[i+430,800]],'#b2bea44d',.7);ctx.restore();}
  // Tiny roofs: deterministic placement, kept away from working roads and water.
  const unique=net.edges.filter((e,i)=>i%2===0),buildings=[];
  for(let i=0;i<760;i++){
   const x=42+R()*1010,y=50+R()*605;if(x<320&&y<300)continue;
   const near=Math.min(...unique.map(e=>distanceSegment({x,y},e.a,e.b)));
   if(near<31||near>105)continue;if(Math.abs(x-(590+y*.30))<36)continue;
   if(buildings.some(b=>Math.hypot(b.x-x,b.y-y)<24))continue;
   buildings.push({x,y});const w=9+R()*17,h=7+R()*15,slant=4;
   const shade=R()<.25?'#b8c2ac':R()<.5?'#d7cdb6':'#d5d5c4';
   poly(ctx,[[x+3,y+4],[x+w+3,y+4],[x+w+slant+3,y+h+4],[x+slant+3,y+h+4]],'#354d3d0d');
   poly(ctx,[[x,y],[x+w,y],[x+w+slant,y+h],[x+slant,y+h]],shade,'#a4ae975c');
   line(ctx,[[x+2,y+h*.45],[x+w+1,y+h*.45]],'#edf0dc8c',.7);
   if(w>19){line(ctx,[[x+w*.5,y+1],[x+w*.5+3,y+h-1]],'#98a18766',.7);}
  }
  // Small groves: duplicated impressions give a quiet printed texture.
  for(let i=0;i<150;i++){const x=25+R()*1040,y=65+R()*600;if(x<300&&y<290)continue;if(unique.some(e=>distanceSegment({x,y},e.a,e.b)<33))continue;if(Math.abs(x-(590+y*.30))<28)continue;const r=2.8+R()*3.9;circle(ctx,x+2,y+3,r,'#d4d5c0');circle(ctx,x,y,r,R()<.4?'#9aa98d':'#b1b99d');line(ctx,[[x,y-2],[x,y+5]],'#819674',.7);}
  // Railway, deliberately fine so it reads as setting rather than a playable road.
  const rail=[[333,747],[475,600],[636,514],[755,428],[873,361],[1017,251],[1140,186]];
  line(ctx,rail,'#96a18f',2.4);line(ctx,rail,C.paper,1.1);
  for(let k=0;k<rail.length-1;k++){const [x,y]=rail[k],[u,v]=rail[k+1],len=Math.hypot(u-x,v-y),dx=(u-x)/len,dy=(v-y)/len;for(let d=0;d<len;d+=9){line(ctx,[[x+dx*d-dy*3.2,y+dy*d+dx*3.2],[x+dx*d+dy*3.2,y+dy*d-dx*3.2]],'#9fa892',.7);}}
  ctx.save();ctx.translate(697,481);ctx.rotate(-.57);ctx.fillStyle='#d8c9a8';ctx.fillRect(-32,-9,64,16);ctx.strokeStyle='#7b8e79';ctx.lineWidth=.8;ctx.strokeRect(-32,-9,64,16);for(let x=-27;x<30;x+=8)line(ctx,[[x,-6],[x,4]],'#eeebd8',1);ctx.restore();text(ctx,'駅',728,505,13,'#7f8975');
  // District annotations / authorial margin notes.
  text(ctx,'暮 ら し の 糸',92,643,11,'#8c947e');text(ctx,'仕 事 の 糸',344,583,10,'#8c947e');text(ctx,'ま ち の 中 心',824,417,10,'#8c947e');
  // A compass and drafting scale (explicitly no geographic scale).
  ctx.save();ctx.translate(1006,578);line(ctx,[[0,22],[0,-24]],'#758571',.9);poly(ctx,[[0,-30],[-4,-17],[0,-20],[4,-17]],'#758571');line(ctx,[[-13,0],[13,0]],'#a0ad91',.8);text(ctx,'N',-3,-37,9,'#758571',MONO);ctx.restore();
  text(ctx,'NOT TO SCALE',881,659,8,'#89947f',MONO);text(ctx,'道と地形は、架空です。',880,677,9,'#89947f');
  for(const [x,y]of[[21,24],[1076,24],[21,682],[1076,682]]){line(ctx,[[x-5,y],[x+5,y]],'#bac0ad',.6);line(ctx,[[x,y-5],[x,y+5]],'#bac0ad',.6);}
  return canvas;
 }
 drawRoad(ctx,e,width,main){
  line(ctx,[[e.a.x+1.7,e.a.y+2.4],[e.b.x+1.7,e.b.y+2.4]],'#253b3211',width+5);
  line(ctx,[[e.a.x,e.a.y],[e.b.x,e.b.y]],main?'#526859':'#849180',width+1.7);
  line(ctx,[[e.a.x,e.a.y],[e.b.x,e.b.y]],main?'#334c44':'#778674',width);
  ctx.setLineDash(main?[6,9]:[2,8]);line(ctx,[[e.a.x,e.a.y],[e.b.x,e.b.y]],main?'#c7ceb59a':'#d5dac36b',.85);ctx.setLineDash([]);
 }
 carPoint(e,c,sim){let t=c.p/e.len,dx=(e.b.x-e.a.x)/e.len,dy=(e.b.y-e.a.y)/e.len;let offset=4.7;
  if(c.lane===1)offset=.6;const pos={x:e.a.x+(e.b.x-e.a.x)*t+dy*offset,y:e.a.y+(e.b.y-e.a.y)*t-dx*offset,a:Math.atan2(dy,dx),elev:0};
  if(e.main){
   if(e.j>=0&&sim.config.junctions[e.j].flyover&&c.route[c.idx+2]&&!['a','b'].includes(c.route[c.idx+2][0])){const d=e.len-c.p;if(d<65)pos.elev=21*Math.cos(d/65*Math.PI/2);}
   const j=e.from[0]==='j'?+e.from.slice(1):-1;
   if(j>=0&&sim.config.junctions[j].flyover&&c.idx>0&&['s','n','j'].includes(c.route[c.idx-1][0])&&c.p<65)pos.elev=21*Math.cos(c.p/65*Math.PI/2);
  }
  pos.y-=pos.elev;return pos;
 }
 drawCar(ctx,e,c,sim){const p=this.carPoint(e,c,sim);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);const len=E.carLength(c),w=c.bus?4.5:3.5;
  if(p.elev){ctx.fillStyle='#23372f18';ctx.fillRect(-len*.5+2,2,len,w);}
  ctx.fillStyle=E.carColor(c);
  ctx.beginPath();ctx.roundRect(-len*.5,-w*.5,len,w,1.1);ctx.fill();
  if(c.bus){ctx.strokeStyle='#7b744866';ctx.lineWidth=.6;for(let x=-3;x<=3;x+=3){ctx.beginPath();ctx.moveTo(x,-1.6);ctx.lineTo(x,1.6);ctx.stroke();}}
  else{ctx.fillStyle='#91a391';ctx.fillRect(1,-w*.5+.4,1,w-.8);}
  ctx.restore();
 }
 drawOverpass(ctx,j,ghost=false){const n=E.POINTS[j+1],prev=E.POINTS[j],next=E.POINTS[j+2];const dx=(next.x-prev.x),dy=(next.y-prev.y),len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  ctx.save();if(ghost)ctx.globalAlpha=.42;
  for(const sign of[-1,1]){const x=n.x+ux*32*sign,y=n.y+uy*32*sign;line(ctx,[[x,y-17],[x+1,y+4]],'#a9af95',4);}
  const ribbon=(lower=0)=>{ctx.beginPath();ctx.moveTo(n.x-ux*68,n.y-uy*68+lower);ctx.bezierCurveTo(n.x-ux*40,n.y-uy*40-26+lower,n.x+ux*40,n.y+uy*40-26+lower,n.x+ux*68,n.y+uy*68+lower);};
  ribbon(5);ctx.strokeStyle='#283e321e';ctx.lineWidth=23;ctx.stroke();ribbon();ctx.strokeStyle='#9caa8d';ctx.lineWidth=23;ctx.stroke();ribbon();ctx.strokeStyle='#496b58';ctx.lineWidth=19;ctx.stroke();ribbon();ctx.setLineDash([5,7]);ctx.strokeStyle='#dee2c2';ctx.lineWidth=.8;ctx.stroke();ctx.setLineDash([]);ctx.restore();
 }
 render(sim,options={}){
  if(!this.w||!this.h)return;const ctx=this.ctx,{selected=-1,heat=false,hover=-1,intro=false}=options;
  ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle=C.paper;ctx.fillRect(0,0,this.w,this.h);ctx.setTransform(this.dpr*this.scale,0,0,this.dpr*this.scale,this.tx*this.dpr,this.ty*this.dpr);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.drawImage(this.background,0,0,1100,700);
  // All 16 two-way road segments, each drawn once.
  const seen=new Set();for(const e of sim.net.edges){const key=[e.from,e.to].sort().join('/');if(seen.has(key))continue;seen.add(key);this.drawRoad(ctx,e,e.main?26:18,e.main);}
  // Operational markings and zebra crossings.
  for(let j=0;j<5;j++){const n=E.POINTS[j+1],cfg=sim.config.junctions[j];
   if(cfg.pocket){for(const e of sim.net.edges.filter(e=>e.j===j&&e.main)){const dx=(e.b.x-e.a.x)/e.len,dy=(e.b.y-e.a.y)/e.len;line(ctx,[[n.x-dx*77+dy*5,n.y-dy*77-dx*5],[n.x-dx*14+dy*5,n.y-dy*14-dx*5]],'#65846b',9);ctx.setLineDash([3,5]);line(ctx,[[n.x-dx*74,n.y-dy*74],[n.x-dx*15,n.y-dy*15]],'#d0d8b7',.8);ctx.setLineDash([]);}}
   for(const e of sim.net.edges.filter(e=>e.j===j)){const dx=(e.b.x-e.a.x)/e.len,dy=(e.b.y-e.a.y)/e.len,half=(e.main?13:9),stop=E.ROAD.stopBar/E.ROAD.scale,cross=E.ROAD.crossing/E.ROAD.scale;
    ctx.save();ctx.translate(n.x,n.y);ctx.rotate(Math.atan2(dy,dx));ctx.fillStyle='#ecebd1';ctx.fillRect(-stop-E.ROAD.stopThickness/E.ROAD.scale/2,-half,E.ROAD.stopThickness/E.ROAD.scale,half);
    for(let k=-half;k<half;k+=3.4)ctx.fillRect(-cross-2.5,k,5,1.8);ctx.restore();}

  }
  // Space occupied by queues is visible instead of a detached warning icon.
  if(heat){for(const e of sim.net.edges){const stalled=e.lanes.flat().filter(c=>c.stopped);if(!stalled.length)continue;const min=Math.min(...stalled.map(c=>c.p));const t=min/e.len;line(ctx,[[e.a.x+(e.b.x-e.a.x)*t,e.a.y+(e.b.y-e.a.y)*t],[e.b.x,e.b.y]],'#c66b443b',e.main?39:29);}}
  for(const e of sim.net.edges)for(const lane of e.lanes)for(const c of lane){if(this.carPoint(e,c,sim).elev<=.1)this.drawCar(ctx,e,c,sim);}
  for(let j=0;j<5;j++)if(sim.config.junctions[j].flyover)this.drawOverpass(ctx,j);
  for(const e of sim.net.edges)for(const lane of e.lanes)for(const c of lane){if(this.carPoint(e,c,sim).elev>.1)this.drawCar(ctx,e,c,sim);}
  if(options.ghostFlyover>=0&&!sim.config.junctions[options.ghostFlyover].flyover)this.drawOverpass(ctx,options.ghostFlyover,true);
  // Same sidewalk/crosswalk coordinates and lifetime as the 3D view.
  for(let j=0;j<5;j++){const slots=[0,0];for(const p of sim.pedQueues[j]){const k=slots[p.id%2]++;if(k>=28)continue;const at=E.pedestrianWait(sim.net,p,k);circle(ctx,at.x,at.y,1.25,p.id%3===0?'#c7a363':p.id%3===1?'#426a58':'#a66b51');}}
  for(const p of sim.walking){const at=E.pedestrianPose(sim.net,p,sim.t);ctx.save();ctx.globalAlpha=at.alpha;circle(ctx,at.x,at.y,1.25,p.id%3===0?'#c7a363':p.id%3===1?'#426a58':'#a66b51');ctx.restore();}
  const queues=sim.queueCounts();
  for(let j=0;j<5;j++){
   const n=E.POINTS[j+1],sg=sim.signalAt(j),active=selected===j&&!intro;
   if(active){circle(ctx,n.x,n.y,43,null,'#bd553b55');ctx.setLineDash([2,5]);circle(ctx,n.x,n.y,49,null,'#bd553b44');ctx.setLineDash([]);}
   // Two signal bars encode direction, not colour alone.
   const prev=E.POINTS[j],next=E.POINTS[j+2],a=Math.atan2(next.y-prev.y,next.x-prev.x);ctx.save();ctx.translate(n.x,n.y);ctx.rotate(a);line(ctx,[[-5,-19],[5,-19]],sg.main?'#b4c891':'#ba6b4e',2.3);line(ctx,[[19,-5],[19,5]],sg.cross?'#b4c891':'#ba6b4e',2.3);ctx.restore();
   if(sim.config.junctions[j].rightArrow)text(ctx,sg.arrow?'→':'·',n.x-25,n.y-28,12,sg.arrow?'#b4c891':'#52634f',MONO);
   const mx=n.x-10,my=n.y-38;line(ctx,[[mx,my+13],[n.x-4,n.y-18]],'#758675',.8);circle(ctx,mx,my,14,active?C.red:C.paper,active?C.red:C.ink);ctx.textAlign='center';text(ctx,String(j+1).padStart(2,'0'),mx,my+4,10,active?C.paper:C.ink,MONO);ctx.textAlign='left';
   if(!intro){const [lx,ly]=n.label;const label=n.name;ctx.font='12px '+FONT;const w=ctx.measureText(label).width;ctx.fillStyle='#f3eee3e8';ctx.fillRect(n.x+lx-5,n.y+ly-14,w+10,23);text(ctx,label,n.x+lx,n.y+ly,12,active?C.red:C.ink);
    if(heat){text(ctx,'待ち '+queues[j]*E.SAMPLE+' 台',n.x+lx,n.y+ly+16,9,queues[j]>4?C.red:C.muted,MONO);}
   }
   if(hover===j&&!active&&!intro)circle(ctx,mx,my,18,null,C.red);
  }
  // Boundary backlog is explicitly shown and remains in the score.
  if(sim.pending.length){text(ctx,'地図の外でも '+sim.pending.length*E.SAMPLE+' 台が待っています',63,690,9,C.red,FONT);}
  // A small route badge, part of the atlas rather than a navigation map.
  const bx=144,by=570;ctx.save();ctx.translate(bx,by);poly(ctx,[[-12,-10],[12,-10],[12,3],[0,12],[-12,3]],C.paper,'#71816c');ctx.textAlign='center';text(ctx,'19',0,3,10,C.ink,MONO);ctx.restore();ctx.textAlign='left';
 }
}
root.HODOKU_ATLAS=Atlas;
})(globalThis);
