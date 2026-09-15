/* HODOKU DIORAMA — original WebGL renderer. No CDN, textures or third-party code.
 * Physics remains in engine.js. Scene geometry, cameras, shadows and interaction
 * are deliberately independent of the deterministic simulation clock.
 */
(function(root){
'use strict';
const E=root.HODOKU,TAU=Math.PI*2,S=E.ROAD.scale;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const world=p=>[(p.x-540)*S,0,(p.y-350)*S];
const colorCache=new Map();
function rgb(c){if(Array.isArray(c))return c;if(colorCache.has(c))return colorCache.get(c);const h=c.replace('#',''),a=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);colorCache.set(c,a);return a;}
function tint(c,v){return rgb(c).map(x=>clamp(x*v,0,1));}
function matmul(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[i+4*j]+=a[i+4*k]*b[k+4*j];return c;}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function look(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function transform(m,p){return [0,1,2,3].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}
const C={paper:'#ece8dc',ground:'#cbd0af',grass:'#bfc79e',road:'#596b64',side:'#6f7c6d',kerb:'#e4e1ca',line:'#f1e8cc',water:'#86b9b2',bank:'#a6bba0',trunk:'#7e7561',leaf:'#7e9876',dark:'#29463e',red:'#cb664b',gold:'#d9ad61',wood:'#c3b48f'};
class Mesh{
 constructor(){this.data=[];}
 tri(a,b,c,col,em=0){const n=norm(cross(sub(b,a),sub(c,a))),co=rgb(col);for(const p of[a,b,c])this.data.push(...p,...n,...co,em);}
 quad(a,b,c,d,col,em=0){this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);}
 box(x,y,z,w,h,d,col,angle=0,em=0){const co=Math.cos(angle),si=Math.sin(angle);const p=(a,b,c)=>[x+a*co-c*si,y+b,z+a*si+c*co],a=w/2,b=h/2,c=d/2;
 const v=[p(-a,-b,-c),p(a,-b,-c),p(a,b,-c),p(-a,b,-c),p(-a,-b,c),p(a,-b,c),p(a,b,c),p(-a,b,c)];
 for(const f of[[3,7,6,2],[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[0,1,5,4]])this.quad(...f.map(i=>v[i]),col,em);
 }
 disc(x,y,z,r,col,n=20){for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;this.tri([x,y,z],[x+Math.sin(a)*r,y,z+Math.cos(a)*r],[x+Math.sin(b)*r,y,z+Math.cos(b)*r],col);}}
 ring(x,y,z,r,w,col,n=32){for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;this.quad([x+Math.sin(a)*(r-w),y,z+Math.cos(a)*(r-w)],[x+Math.sin(a)*r,y,z+Math.cos(a)*r],[x+Math.sin(b)*r,y,z+Math.cos(b)*r],[x+Math.sin(b)*(r-w),y,z+Math.cos(b)*(r-w)],col,.25);}}
 cone(x,y,z,r,h,col,n=7,rt=0){for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n,A=[x+Math.sin(a)*r,y,z+Math.cos(a)*r],B=[x+Math.sin(b)*r,y,z+Math.cos(b)*r],D=[x+Math.sin(a)*rt,y+h,z+Math.cos(a)*rt],F=[x+Math.sin(b)*rt,y+h,z+Math.cos(b)*rt];this.quad(A,B,F,D,tint(col,.94+(i%3)*.025));if(rt)this.tri([x,y+h,z],D,F,col);}}
 ribbon(points,w,col,thick=0,em=0){const sides=points.map((p,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next[0]-prev[0],dz=next[2]-prev[2],l=Math.hypot(dx,dz)||1;return [[p[0]-dz/l*w/2,p[1],p[2]+dx/l*w/2],[p[0]+dz/l*w/2,p[1],p[2]-dx/l*w/2]];});
 for(let i=1;i<points.length;i++){const[a,b]=sides[i-1],[c,d]=sides[i];this.quad(a,c,d,b,col,em);if(thick){const lo=p=>[p[0],p[1]-thick,p[2]];this.quad(a,lo(a),lo(c),c,tint(col,.83));this.quad(d,lo(d),lo(b),b,tint(col,.88));this.quad(lo(a),lo(b),lo(d),lo(c),tint(col,.75));}}
 }
 dataArray(){return new Float32Array(this.data);}
}
function distSeg(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);}
function tree(m,x,z,h=4,pine=false,R=()=>.5){m.box(x,h*.25,z,.22,h*.5,.22,C.trunk);if(pine){m.cone(x,h*.24,z,h*.32,h*.66,C.dark,7);m.cone(x,h*.49,z,h*.24,h*.56,'#597963',7);}else{m.cone(x,h*.37,z,h*.31,h*.36,C.leaf,7,h*.32);m.cone(x,h*.73,z,h*.32,h*.27,'#91a481',7);}}
function house(m,x,z,w,d,h,roof,angle=0,type=0){
 m.box(x,.2,z,w+.55,.3,d+.55,'#b2b69b',angle);m.box(x,h/2+.3,z,w,h,d,type===2?'#ded9bc':'#eee6cf',angle);
 const co=Math.cos(angle),si=Math.sin(angle),p=(a,b,c)=>[x+a*co-c*si,b,z+a*si+c*co];
 if(type===0||type===1){const a=w*.58,b=d*.59,base=h+.34,top=base+Math.min(w,d)*.38;
  m.quad(p(-a,base,-b),p(-a,base,b),p(0,top,b),p(0,top,-b),roof);m.quad(p(0,top,-b),p(0,top,b),p(a,base,b),p(a,base,-b),roof);
  m.tri(p(-w/2,base,-d/2),p(w/2,base,-d/2),p(0,top,-d/2),'#e8dfc6');m.tri(p(w/2,base,d/2),p(-w/2,base,d/2),p(0,top,d/2),'#e8dfc6');
  if(type===1){const a=p(w*.2,top+.15,0);m.box(a[0],a[1],a[2],.5,1,.55,'#c5b59a',angle);}
 }else{m.box(x,h+.5,z,w+.35,.38,d+.35,roof,angle);const a=p(-w*.21,h+.9,d*.1);m.box(a[0],a[1],a[2],w*.3,.7,d*.24,'#c0c3af',angle);}
 // Recessed ribbon windows, enough detail to read at street level without noise.
 for(let row=0;row<Math.max(1,Math.floor(h/1.7));row++)for(let j=0;j<Math.max(1,Math.floor(w/1.5));j++){
  const xx=-w*.34+j*1.45,yy=1.02+row*1.55;if(xx>w*.38)continue;for(const sign of[-1,1]){const a=p(xx,yy,sign*(d/2+.014));m.box(a[0],a[1],a[2],.62,.69,.035,'#718d83',angle);}}
 const a=p(w*.24,.92,d/2+.03);m.box(a[0],a[1],a[2],.69,1.35,.04,C.trunk,angle);
}
function mountain(m,x,z,r,h,R){const n=9,ring=[];for(let i=0;i<n;i++){const a=i*TAU/n;ring.push([x+Math.sin(a)*r*(.8+R()*.3),.1,z+Math.cos(a)*r*(.55+R()*.23)]);}const peak=[x-r*.16,h,z-r*.05];
 for(let i=0;i<n;i++){const a=ring[i],b=ring[(i+1)%n],snowA=add(mul(a,.24+R()*.14),mul(peak,.76-R()*.05)),snowB=add(mul(b,.28),mul(peak,.72));snowA[0]=mix(peak[0],a[0],.28);snowA[1]=mix(peak[1],a[1],.28);snowA[2]=mix(peak[2],a[2],.28);m.quad(a,b,snowB,snowA,['#718779','#829486','#92a093'][i%3]);m.tri(snowA,snowB,peak,['#e4e5d5','#f1eee1','#d4dccc'][i%3]);}}
const VS=`precision highp float;attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;attribute float aEmissive;uniform mat4 uVP;uniform mat4 uLight;varying vec3 vNormal;varying vec3 vColor;varying vec3 vPos;varying vec4 vLight;varying float vEmissive;void main(){vNormal=aNormal;vColor=aColor;vPos=aPosition;vLight=uLight*vec4(aPosition,1.0);vEmissive=aEmissive;gl_Position=uVP*vec4(aPosition,1.0);}`;
const FS=`precision highp float;varying vec3 vNormal;varying vec3 vColor;varying vec3 vPos;varying vec4 vLight;varying float vEmissive;uniform sampler2D uShadow;uniform vec3 uSun;uniform vec3 uEye;uniform float uShadowSize;uniform float uShadows;uniform vec3 uSky;float unpack(vec4 c){return dot(c,vec4(0.000000059604644775,0.0000152587890625,0.00390625,1.0));}void main(){if(vEmissive<0.0){float d=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));if(d> -vEmissive)discard;}vec3 n=normalize(vNormal);float ndl=max(0.0,dot(n,uSun));vec3 sc=vLight.xyz/vLight.w*.5+.5;float vis=1.0;if(uShadows>.5&&sc.x>0.0&&sc.x<1.0&&sc.y>0.0&&sc.y<1.0&&sc.z<1.0){vis=0.0;float bias=max(.00045,.0010*(1.0-ndl));for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){float depth=unpack(texture2D(uShadow,sc.xy+vec2(float(x),float(y))/uShadowSize));vis+=sc.z-bias<=depth?1.0:.0;}}vis/=9.0;}float hemi=.68+.10*max(0.0,n.y);vec3 lit=vec3(hemi)+vec3(.27,.255,.21)*ndl*(.20+.80*vis);vec3 col=vColor*mix(lit,vec3(1.1),max(0.0,vEmissive));float fog=smoothstep(260.0,550.0,length(uEye-vPos));col=mix(col,uSky,fog*.35);float grain=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*.008;gl_FragColor=vec4(col+grain,1.0);}`;
const SV=`precision highp float;attribute vec3 aPosition;uniform mat4 uVP;void main(){gl_Position=uVP*vec4(aPosition,1.0);}`;
const SF=`precision highp float;void main(){vec4 c=fract(gl_FragCoord.z*vec4(16777216.0,65536.0,256.0,1.0));c-=c.xxyz*vec4(0.0,.00390625,.00390625,.00390625);gl_FragColor=c;}`;
function program(gl,vs,fs){const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const a=compile(gl.VERTEX_SHADER,vs),b=compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);gl.deleteShader(a);gl.deleteShader(b);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
class Diorama{
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});if(!this.gl)throw Error('WebGL is not available');const gl=this.gl;
  this.program=program(gl,VS,FS);this.depthProgram=program(gl,SV,SF);this.loc={};for(const n of['uVP','uLight','uShadow','uSun','uEye','uShadowSize','uShadows','uSky'])this.loc[n]=gl.getUniformLocation(this.program,n);this.dloc=gl.getUniformLocation(this.depthProgram,'uVP');this.attrs={};for(const n of['aPosition','aNormal','aColor','aEmissive'])this.attrs[n]=gl.getAttribLocation(this.program,n);this.dattr=gl.getAttribLocation(this.depthProgram,'aPosition');
  this.sun=norm([-80,130,60]);this.lightVP=matmul(ortho(-138,138,-115,115,1,400),look([-100,180,100],[0,0,0]));this.shadows=true;this.shadowSize=innerWidth<761?1024:2048;this.setupShadow();
  this.buffers={world:this.buffer(),roads:this.buffer(),actors:this.buffer()};this.buildWorld();this.configKey='';this.stageId=-1;this.oldIntro=null;this.mode='model';this.selected=1;this.followId=null;this.last=0;this.frames=0;this.drawCalls=0;this.angleMoved=false;this.suppressUntil=0;this.lastCarCount=0;this.lastElevated=0;this.lost=false;this.shadowDirty=true;
  this.camera={x:0,y:0,z:0,r:235,yaw:.27,elev:.82,fov:.67};this.target={...this.camera};this.eye=[0,0,0];this.vp=new Float32Array(16);this.pins=[];this.initPins();this.initInput();this.resize();this.visible=true;this.visibilityObserver=new IntersectionObserver(es=>this.visible=es[0].isIntersecting);this.visibilityObserver.observe(canvas);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.announce('3Dの描画が一時停止しました。画面を再読み込みすると再開できます。');});
  canvas.addEventListener('webglcontextrestored',()=>{this.announce('3Dの描画を復旧するため、ページを再読み込みしてください。保存を利用できる環境では、設計を復元できます。');});
  root.HODOKU_VIEW=this;
 }
 announce(text){const e=document.getElementById('view-message');if(e){e.textContent=text;e.classList.add('visible');}}
 setupShadow(){const g=this.gl,n=this.shadowSize;this.shadowTex=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.shadowTex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,n,n,0,g.RGBA,g.UNSIGNED_BYTE,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);this.fbo=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,this.fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.shadowTex,0);this.depth=g.createRenderbuffer();g.bindRenderbuffer(g.RENDERBUFFER,this.depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,n,n);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.depth);this.shadows=g.checkFramebufferStatus(g.FRAMEBUFFER)===g.FRAMEBUFFER_COMPLETE;g.bindFramebuffer(g.FRAMEBUFFER,null);}
 buffer(){return {id:this.gl.createBuffer(),count:0};}
 upload(buf,mesh,dynamic=false){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,buf.id);g.bufferData(g.ARRAY_BUFFER,mesh.dataArray(),dynamic?g.DYNAMIC_DRAW:g.STATIC_DRAW);buf.count=mesh.data.length/10;}
 buildWorld(){const m=new Mesh(),R=E.rng(8675309),edges=E.makeNetwork(E.baseConfig()).edges.filter((_,i)=>i%2===0).map(e=>[world(e.a),world(e.b)]);
  // Thick, cut-paper land, floated above a warm tabletop.
  m.box(0,-6.3,0,200,.6,144,'#e4decb');m.box(0,-4.6,0,190,2.7,130,C.wood);m.box(0,-2.45,0,190,1.7,130,'#ddd1ae');m.box(0,-1.25,0,190,.7,130,'#b4bb98');m.box(0,-.5,0,190,1,130,C.ground);
  // Faint survey grid cut into the surface; no decorative dashboard grid.
  for(let i=-80;i<=80;i+=20)for(let j=-50;j<=50;j+=20){m.box(i,.008,j,.45,.012,.06,'#bcc3a0');m.box(i,.008,j,.06,.012,.45,'#bcc3a0');}
  // A handmade river, with narrow bank strata and small surface scratches.
  this.river=[];for(let i=0;i<=52;i++){const z=-65+i*2.5,x=10+z*.28+Math.sin(z*.075)*4;this.river.push([x,.055,z]);}
  m.ribbon(this.river,7.8,'#b1c0a4');m.ribbon(this.river.map(p=>[p[0],.07,p[2]]),5.6,C.water);
  for(let i=0;i<60;i++){const z=-62+R()*124,x=10+z*.28+Math.sin(z*.075)*4+(R()-.5)*3;m.box(x,.083,z,.055,.015,.3+R()*1.4,'#b7d2c2',-.2);}
  // Engraved fields and orchards.
  for(const f of[[-75,35,12,12],[-41,45,15,9],[65,42,20,16],[74,-12,10,13],[-27,-32,11,13]]){
   const[x,z,w,d]=f;m.box(x,.03,z,w,.06,d,'#b4bd92');for(let a=-w/2+1;a<w/2;a+=1.5)m.box(x+a,.065,z,.13,.03,d-.7,'#d1cc9d');}
  for(let i=0;i<3;i++)mountain(m,-75+i*18,-45-i%2*7,21-i*2,23+i%2*9,R);
  for(let i=0;i<70;i++){const x=-89+R()*63,z=-61+R()*35;if(edges.some(([a,b])=>distSeg(x,z,a,b)<6))continue;tree(m,x,z,2.5+R()*3.5,true,R);}
  const houses=[];for(let i=0;i<550;i++){const x=-86+R()*173,z=-59+R()*116;if(x<-30&&z<-24)continue;const near=Math.min(...edges.map(([a,b])=>distSeg(x,z,a,b)));if(near<7.4||near>20)continue;const rx=10+z*.28+Math.sin(z*.075)*4;if(Math.abs(x-rx)<6)continue;if(houses.some(p=>Math.hypot(x-p[0],z-p[1])<7.5))continue;
   houses.push([x,z]);const w=3.6+R()*3.5,d=3.5+R()*3.2,h=2+R()*3.4;let angle=R()<.8?-.35:Math.PI/2-.35;const roof=['#657f71','#b37760','#b3a27c','#6e8786'][Math.floor(R()*4)];house(m,x,z,w,d,h,roof,angle,R()<.26?2:R()<.5?1:0);if(R()<.4)tree(m,x+w/2+1.5,z+d*.3,3.1+R(),false,R);}
  // A saw-tooth workshop, a station shelter and a water tank: specific places, not generic towers.
  m.box(36,.4,39,16,.6,5,'#d9d3b9',-.35);m.box(36,3.3,39,15,.35,4.3,'#7c9588',-.35);for(let i=-1;i<=1;i++)m.box(36+i*5,1.9,39,.25,3,.25,C.dark);
  // Tiny local railway is scenery only, visually thinner than playable roads.
  const rail=[];for(let i=0;i<26;i++)rail.push([-30+i*4,.12,61-i*2.05]);m.ribbon(rail,2.3,'#b9b89e');m.ribbon(rail.map(p=>[p[0]+.48,p[1]+.04,p[2]]),.1,'#6e7d71');m.ribbon(rail.map(p=>[p[0]-.48,p[1]+.04,p[2]]),.1,'#6e7d71');for(const p of rail)m.box(p[0],.13,p[2],2.2,.12,.23,'#989b80',-.48);
  // Trees are kept clear of all road corridors.
  for(let i=0;i<160;i++){const x=-88+R()*175,z=-60+R()*118;if(x<-28&&z<-24)continue;const near=Math.min(...edges.map(([a,b])=>distSeg(x,z,a,b)));if(near<5||near>21||houses.some(p=>Math.hypot(x-p[0],z-p[1])<4.3))continue;const rx=10+z*.28+Math.sin(z*.075)*4;if(Math.abs(x-rx)<5)continue;tree(m,x,z,2.3+R()*2.6,R()<.33,R);}
  // Corner survey stakes and a brass studio plate.
  for(const x of[-90,90])for(const z of[-60,60]){m.disc(x,.04,z,.7,'#ded4b4',12);m.box(x,.07,z,.75,.06,.09,'#84927b');m.box(x,.07,z,.09,.06,.75,'#84927b');}
  m.box(63,.10,60,33,.18,3.6,'#d7c18a');for(let i=0;i<13;i++)m.box(48+i*2.3,.21,60,.3,.03,i%3?1.25:2.1,'#8b8f70');
  this.upload(this.buffers.world,m);this.worldTriangles=m.data.length/30;this.shadowDirty=true;
 }
 bridgePoint(j,t){const n=world(E.POINTS[j+1]),other=world(E.POINTS[t<0?j:j+2]),dir=norm(sub(other,n)),d=Math.abs(t),L=12;return [n[0]+dir[0]*d,.27+5.2*(.5+.5*Math.cos(Math.PI*d/L)),n[2]+dir[2]*d];}
 buildRoads(sim){const m=new Mesh(),net=sim.net;
  // Road kerbs, a raised asphalt ribbon, and center dashes.
  for(let i=0;i<net.edges.length;i+=2){const e=net.edges[i],a=world(e.a),b=world(e.b),len=e.len*S,dx=(b[0]-a[0])/len,dz=(b[2]-a[2])/len,w=e.main?E.ROAD.mainWidth:E.ROAD.sideWidth;
   m.ribbon([[a[0],.14,a[2]],[b[0],.14,b[2]]],w+E.ROAD.kerb,C.kerb,.14);m.ribbon([[a[0],.22,a[2]],[b[0],.22,b[2]]],w,e.main?C.road:C.side,.06);
   for(let d=2;d<len-1;d+=3.3){const p=[a[0]+dx*d,.232,a[2]+dz*d],q=[a[0]+dx*Math.min(d+1.2,len-1),.232,a[2]+dz*Math.min(d+1.2,len-1)];m.ribbon([p,q],.1,'#dedec3');}
  }
  for(let j=0;j<5;j++){const n=world(E.POINTS[j+1]),cfg=sim.config.junctions[j];m.disc(n[0],.25,n[2],2.85,C.road,20);
   // Markings and vehicle front-bumper stops share the engine geometry.
   const incoming=net.edges.filter(e=>e.j===j),stopBar=E.ROAD.stopBar,crossing=E.ROAD.crossing;for(const e of incoming){const a=world(e.a),dir=norm(sub(n,a)),nx=-dir[2],nz=dir[0],heading=Math.atan2(dir[2],dir[0]);
    const p=[n[0]-dir[0]*stopBar,.265,n[2]-dir[2]*stopBar];const half=(e.main?E.ROAD.mainWidth:E.ROAD.sideWidth)/2; m.box(p[0]-nx*half/2,p[1],p[2]-nz*half/2,E.ROAD.stopThickness,.025,half-.06,C.line,heading);
    const bands=e.main?8:6;for(let k=0;k<bands;k++){const side=(k-(bands-1)/2)*.55;const q=[n[0]-dir[0]*crossing+nx*side,.264,n[2]-dir[2]*crossing+nz*side];m.box(q[0],q[1],q[2],E.ROAD.crossingDepth,.015,.30,C.line,heading);}
    const pole=[n[0]-dir[0]*4.4+nx*2.65,n[2]-dir[2]*4.4+nz*2.65];m.box(pole[0],1.45,pole[1],.11,2.55,.11,C.dark);m.box(pole[0]-nx*.46,2.7,pole[1]-nz*.46,1.2,.10,.11,C.dark,heading+Math.PI/2);m.box(pole[0]-nx*.91,2.67,pole[1]-nz*.91,.22,.39,1.04,C.dark,heading);
   }
   if(cfg.pocket){for(const e of net.edges.filter(e=>e.j===j&&e.main)){const a=world(e.a),dir=norm(sub(n,a)),d=12;const p=[n[0]-dir[0]*d,.269,n[2]-dir[2]*d],q=[n[0]-dir[0]*3.5,.269,n[2]-dir[2]*3.5];m.ribbon([p,q],.14,C.gold);for(let k=0;k<2;k++){const t=6+k*3;const at=[n[0]-dir[0]*t,.28,n[2]-dir[2]*t],side=[-dir[2],0,dir[0]];m.ribbon([add(at,mul(dir,-.8)),at,add(at,mul(side,-.7))],.14,C.line);}}
   }
   if(cfg.flyover){const ps=[];for(let t=-12;t<=12.001;t+=.5)ps.push(this.bridgePoint(j,t));m.ribbon(ps,5.0,'#d6d4b9',.44);m.ribbon(ps.map(p=>[p[0],p[1]+.04,p[2]]),4.45,'#617d70',.03);
    for(const off of[-2.35,2.35]){const rail=ps.map((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],d=norm(sub(b,a));return [p[0]-d[2]*off,p[1]+.48,p[2]+d[0]*off];});m.ribbon(rail,.13,'#dddcca',.16);for(let i=2;i<rail.length-2;i+=4){const p=rail[i];m.box(p[0],p[1]-.25,p[2],.1,.5,.1,'#cad0b7');}}
    for(let t=-9;t<10;t+=1.9){const a=this.bridgePoint(j,t),b=this.bridgePoint(j,Math.min(t+.7,12));a[1]+=.065;b[1]+=.065;m.ribbon([a,b],.12,C.line);}
    for(const t of[-6,-2,2,6]){const p=this.bridgePoint(j,t),a=this.bridgePoint(j,t-.2),b=this.bridgePoint(j,t+.2),dir=norm(sub(b,a)),h=p[1]-.5;for(const off of[-1.78,1.78]){const x=p[0]-dir[2]*off,z=p[2]+dir[0]*off;m.box(x,h/2,z,.5,h,.5,'#c6c8b1');m.box(x,.25,z,.9,.4,.9,'#bec2a9');}}
   }
  }
  this.upload(this.buffers.roads,m);this.shadowDirty=true;
 }
 carPosition(e,c,sim,alpha=1){const p=mix(c.prevP,c.p,clamp(alpha,0,1)),len=e.len,dx=(e.b.x-e.a.x)/len,dz=(e.b.y-e.a.y)/len,nxt=c.route[c.idx+2],mainId=id=>id&&['s','n','j'].includes(id[0]);let off=c.lane===1?mix(.94,.50,smooth((p-(len-95))/65)):(e.j>=0&&e.main&&sim.config.junctions[e.j].pocket?1.55:.94);
  let x=(e.a.x-540)*S+dx*p*S+dz*off,z=(e.a.y-350)*S+dz*p*S-dx*off,height=.28,slope=0;
  if(e.main){if(e.j>=0&&sim.config.junctions[e.j].flyover&&mainId(nxt)){const d=(len-p)*S;if(d<12){height+=5.2*(.5+.5*Math.cos(Math.PI*d/12));slope+=2.6*Math.PI/12*Math.sin(Math.PI*d/12);}}const j=e.from[0]==='j'?+e.from.slice(1):-1;if(j>=0&&sim.config.junctions[j].flyover&&c.idx>0&&mainId(c.route[c.idx-1])&&p*S<12){height+=5.2*(.5+.5*Math.cos(Math.PI*p*S/12));slope-=2.6*Math.PI/12*Math.sin(Math.PI*p*S/12);}}
  return {x,y:height,z,angle:Math.atan2(dz,dx),dx,dz,slope};
 }
 buildActors(sim,opt){const m=new Mesh(),cars=[],alpha=opt.alpha??1;let elevated=0;
  for(const e of sim.net.edges)for(const lane of e.lanes)for(const c of lane){const start=m.data.length,p=this.carPosition(e,c,sim,alpha);cars.push({c,p,e,color:E.carColor(c)});if(p.y>1)elevated++;const len=c.bus?1.92:1.09,w=c.bus?.73:.64,co=E.carColor(c);
   m.box(p.x,p.y+.045,p.z,len+.09,.08,w+.09,'#435b50',p.angle);m.box(p.x,p.y+.23,p.z,len,.32,w,co,p.angle);
   m.box(p.x-p.dx*.10,p.y+.5,p.z-p.dz*.10,c.bus?len*.81:len*.54,c.bus?.40:.29,w*.91,c.bus?'#e5c486':co,p.angle);
   const front=c.bus?len*.38:len*.19;m.box(p.x+p.dx*front,p.y+.52,p.z+p.dz*front,.06,c.bus?.25:.2,w*.77,'#486a61',p.angle);
   if(c.bus){for(const side of[-1,1])m.box(p.x-p.dz*side*w*.465,p.y+.57,p.z+p.dx*side*w*.465,len*.62,.2,.016,'#607e71',p.angle);}
   for(const side of[-1,1]){const back=-len*.45;m.box(p.x+p.dx*back-p.dz*side*w*.3,p.y+.27,p.z+p.dz*back+p.dx*side*w*.3,.065,.12,.15,c.stopped?'#f3a16d':'#935944',p.angle,c.stopped?.6:0);}
   // Tilt both positions and normals with the deck, rather than floating a flat car.
   if(Math.abs(p.slope)>.001){const co=1/Math.sqrt(1+p.slope*p.slope),si=p.slope*co;
    for(let i=start;i<m.data.length;i+=10){const x=m.data[i]-p.x,y=m.data[i+1]-p.y,z=m.data[i+2]-p.z,f=x*p.dx+z*p.dz,q=-x*p.dz+z*p.dx,nf=f*co-y*si;m.data[i]=p.x+nf*p.dx-q*p.dz;m.data[i+1]=p.y+f*si+y*co;m.data[i+2]=p.z+nf*p.dz+q*p.dx;
     const nx=m.data[i+3],ny=m.data[i+4],nz=m.data[i+5],a=nx*p.dx+nz*p.dz,b=-nx*p.dz+nz*p.dx,c=a*co-ny*si;m.data[i+3]=c*p.dx-b*p.dz;m.data[i+4]=a*si+ny*co;m.data[i+5]=c*p.dz+b*p.dx;}
   }
  }
  this.people=[];
  for(let j=0;j<5;j++){const n=world(E.POINTS[j+1]),sg=sim.signalAt(j);for(const e of sim.net.edges.filter(e=>e.j===j)){const dir=norm(sub(n,world(e.a))),nx=-dir[2],nz=dir[0],x=n[0]-dir[0]*4.4+nx*1.74,z=n[2]-dir[2]*4.4+nz*1.74,angle=Math.atan2(dir[2],dir[0]),go=e.main?sg.main:sg.cross,amber=e.main?sg.mainAmber:sg.crossAmber;
    for(let k=0;k<3;k++){const u=(k-1)*.30,on=k===0?!go&&!amber:k===1?amber:go,col=on?['#e47352','#edc460','#a2d4ac'][k]:'#394f44';m.box(x-nx*u-dir[0]*.13,2.68,z-nz*u-dir[2]*.13,.025,.23,.23,col,angle,on?.55:0);}
    if(e.main&&sim.config.junctions[j].rightArrow){
     m.box(x,2.22,z,.22,.38,.82,C.dark,angle);
     const col=sg.arrow?'#b1efd0':'#456255',em=sg.arrow?.8:0,fx=x-dir[0]*.126,fz=z-dir[2]*.126;
     m.box(fx-nx*.06,2.22,fz-nz*.06,.025,.065,.38,col,angle,em);
     m.tri([fx+nx*.28,2.22,fz+nz*.28],[fx+nx*.08,2.36,fz+nz*.08],[fx+nx*.08,2.08,fz+nz*.08],col,em);
    }
   }
   const slots=[0,0];for(const p of sim.pedQueues[j]){const bank=p.id%2,k=slots[bank]++,pos=E.pedestrianWait(sim.net,p,k);if(k>=28)continue;
    const w=world(pos);this.person(m,w[0],.15,w[2],p.id);this.people.push({id:p.id,j,phase:'waiting',x:w[0],z:w[2],alpha:1});}
   // Render at the same interpolated clock as the cars; identities and body
   // colours persist all the way from waiting to leaving on the far sidewalk.
   const time=sim.t-E.DT*(1-clamp(alpha,0,1));
   for(const p of sim.walking){if(p.j!==j)continue;const pose=E.pedestrianPose(sim.net,p,time),w=world(pose);this.person(m,w[0],pose.phase==='crossing'?.27:.15,w[2],p.id,time-p.depart,pose.alpha);this.people.push({id:p.id,j,...pose,x:w[0],z:w[2]});}
   // Small pedestrian signal on each bank. It uses the actual admission phase.
   const g=E.pedestrianLayout(sim.net,j);for(const side of[-1,1]){const at=E.pedestrianPoint(sim.net,j,(E.ROAD.crossing+.25)/S,side*g.sidewalk),w=world(at);
    m.box(w[0],.74,w[2],.075,1.20,.075,C.dark);m.box(w[0],1.45,w[2],.25,.47,.25,C.dark);
    const lit=sg.walk?'#b1efd0':'#e47352';m.box(w[0],1.44,w[2],.265,.20,.265,lit,0,.45);
   }
   if(opt.selected===j&&!opt.intro){m.ring(n[0],.28,n[2],4.15,.16,C.gold,40);for(let k=0;k<4;k++){const a=k*TAU/4;m.box(n[0]+Math.sin(a)*4.4,.29,n[2]+Math.cos(a)*4.4,k%2?.7:.12,.045,k%2?.12:.7,C.gold);}}
   if(opt.heat){const q=sim.queueCounts()[j],h=.18+Math.min(6,q*.22);m.cone(n[0]+4.8,.24,n[2]-4.8,.5,h,q>10?C.red:C.gold,8,.5);}
  }
  // Wire-like construction preview; it never changes simulation or budget.
  if(opt.ghostFlyover>=0&&!sim.config.junctions[opt.ghostFlyover].flyover){for(const off of[-2.5,2.5]){const ps=[];for(let t=-12;t<=12;t+=1){const a=this.bridgePoint(opt.ghostFlyover,t),b=this.bridgePoint(opt.ghostFlyover,t+.02),d=norm(sub(b,a));ps.push([a[0]-d[2]*off,a[1]+.3,a[2]+d[0]*off]);}m.ribbon(ps,.15,C.gold);}}
  this.lastCarCount=cars.length;this.lastElevated=elevated;this.cars=cars;this.upload(this.buffers.actors,m,true);
 }
 person(m,x,y,z,id,age=null,opacity=1){const start=m.data.length,step=age===null?0:Math.sin(age*7+id)*.065,coat=id%3===0?'#c7a363':id%3===1?'#426a58':'#a66b51';
  m.box(x-.058,y+.105,z+step,.073,.21,.09,'#42584d');m.box(x+.058,y+.105,z-step,.073,.21,.09,'#42584d');
  m.box(x,y+.37,z,.20,.38,.18,coat);m.cone(x,y+.58,z,.13,.23,'#e1c29e',6,.10);
  if(opacity<1)for(let i=start+9;i<m.data.length;i+=10)m.data[i]=-Math.max(.001,opacity);
 }
 initPins(){let parent=document.getElementById('node-pins');if(!parent){parent=document.createElement('div');parent.id='node-pins';parent.className='node-pins game-only';this.canvas.parentNode.appendChild(parent);}for(let j=0;j<5;j++){const b=document.createElement('button');b.className='node-pin';b.setAttribute('aria-label',`${j+1} ${E.POINTS[j+1].name}を選ぶ`);b.innerHTML=`<b>${String(j+1).padStart(2,'0')}</b><span>${E.POINTS[j+1].name}</span>`;b.addEventListener('click',()=>{root.dispatchEvent(new CustomEvent('hodoku-select',{detail:{node:j,focus:false,scroll:innerWidth<761}}));});parent.appendChild(b);this.pins.push(b);}}
 initInput(){const c=this.canvas;this.pointers=new Map();this.dragStart=null;this.pinch=0;
  c.addEventListener('pointerdown',e=>{if(e.button>2)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});c.setPointerCapture(e.pointerId);this.dragStart={x:e.clientX,y:e.clientY};this.angleMoved=false;this.stopFollow();this.lastInteraction=performance.now();if(this.pointers.size===2){const p=[...this.pointers.values()];this.pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}c.style.cursor='grabbing';});
  c.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;const prev=this.pointers.get(e.pointerId),dx=e.clientX-prev.x,dy=e.clientY-prev.y;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.dragStart&&Math.hypot(e.clientX-this.dragStart.x,e.clientY-this.dragStart.y)>5){this.angleMoved=true;this.suppressUntil=performance.now()+350;}
   if(this.pointers.size>=2){const ps=[...this.pointers.values()],d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(this.pinch>0&&d>0)this.target.r=clamp(this.target.r*this.pinch/d,10,600);this.pinch=d;this.pan(dx*.35,dy*.35);}
   else if(e.shiftKey||e.buttons===2)this.pan(dx,dy);else{this.target.yaw-=dx*.006;this.target.elev=clamp(this.target.elev+dy*.005,.08,1.56);}this.cameraChanged=true;
  });
  const up=e=>{this.pointers.delete(e.pointerId);if(this.pointers.size<2)this.pinch=0;if(this.angleMoved)this.suppressUntil=performance.now()+350;c.style.cursor='grab';};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('wheel',e=>{e.preventDefault();this.stopFollow();this.target.r=clamp(this.target.r*Math.exp(e.deltaY*.0012),10,600);this.lastInteraction=performance.now();},{passive:false});
  c.addEventListener('dblclick',e=>{const j=this.hit(e.clientX,e.clientY);if(j>=0){root.dispatchEvent(new CustomEvent('hodoku-select',{detail:{node:j,focus:true}}));}});
  c.addEventListener('click',e=>{if(performance.now()<this.suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 }
 pan(dx,dy){const f=this.target.r/this.w*.65,a=this.target.yaw;this.target.x=clamp(this.target.x-(Math.cos(a)*dx+Math.sin(a)*dy)*f,-100,100);this.target.z=clamp(this.target.z-(-Math.sin(a)*dx+Math.cos(a)*dy)*f,-70,70);}
 stopFollow(){if(this.mode==='follow'){this.mode='free';this.updateViewButtons();}}
 select(j){this.selected=j;if(this.mode==='focus'||this.mode==='street')this.setView(this.mode,j);}
 setView(mode='model',j=this.selected){this.mode=mode;this.selected=j;this.followId=null;const n=world(E.POINTS[j+1]),mobile=this.w<650;let preset;
  if(mode==='model')preset={x:0,y:0,z:0,r:mobile?420:265,yaw:.27,elev:.82,fov:.67};
  else if(mode==='top')preset={x:0,y:0,z:0,r:mobile?455:285,yaw:0,elev:1.56,fov:.67};
  else if(mode==='focus')preset={x:n[0],y:.4,z:n[2],r:mobile?90:67,yaw:.27,elev:.73,fov:.70};
  else if(mode==='street'){const a=world(E.POINTS[j]),d=norm(sub(n,a));preset={x:n[0],y:.8,z:n[2],r:23,yaw:Math.atan2(-d[0],-d[2]),elev:.13,fov:.91};}
  else if(mode==='follow')preset={r:10.5,elev:.25,fov:.93};
  if(preset){let targetYaw=preset.yaw;if(targetYaw!==undefined){while(targetYaw-this.camera.yaw>Math.PI)targetYaw-=TAU;while(targetYaw-this.camera.yaw< -Math.PI)targetYaw+=TAU;preset.yaw=targetYaw;}Object.assign(this.target,preset);}this.lastInteraction=performance.now();this.updateViewButtons();
 }
 updateViewButtons(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===this.mode)));const e=document.getElementById('camera-name');if(e)e.textContent=({model:'街の模型',top:'真上から',focus:'交差点を観察',street:'路上の高さ',follow:'一台の時間',free:'自由な視点'})[this.mode]||'街の模型';}
 zoom(f){this.stopFollow();this.target.r=clamp(this.target.r*f,10,600);}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);this.dpr=Math.min(root.devicePixelRatio||1,this.w<650?1.5:1.65);const w=Math.round(this.w*this.dpr),h=Math.round(this.h*this.dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.cameraChanged=true;}
 project(p){const v=transform(this.vp,p);if(v[3]<=.01)return {x:-1000,y:-1000,visible:false};return {x:(v[0]/v[3]*.5+.5)*this.w,y:(-.5*v[1]/v[3]+.5)*this.h,visible:Math.abs(v[0]/v[3])<1.1&&Math.abs(v[1]/v[3])<1.1};}
 hit(clientX,clientY){if(performance.now()<this.suppressUntil)return -1;const r=this.canvas.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;let best=-1,d=30;for(let j=0;j<5;j++){const p=world(E.POINTS[j+1]);p[1]=.3;const q=this.project(p),l=Math.hypot(q.x-x,q.y-y);if(q.visible&&l<d){d=l;best=j;}}return best;}
 updatePins(sim,opt){for(let j=0;j<5;j++){const n=world(E.POINTS[j+1]);n[1]=sim.config.junctions[j].flyover?7.1:3.9;const p=this.project(n),b=this.pins[j],selected=j===opt.selected;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));const keep=p.visible&&(!['street','follow'].includes(this.mode)||selected);b.style.display=keep?'':'none';b.style.left=p.x+'px';b.style.top=p.y+'px';b.classList.toggle('near',this.mode==='focus');}}
 draw(buf,depth=false){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,buf.id);if(depth){g.enableVertexAttribArray(this.dattr);g.vertexAttribPointer(this.dattr,3,g.FLOAT,false,40,0);}else{for(const[n,size,off]of[['aPosition',3,0],['aNormal',3,12],['aColor',3,24],['aEmissive',1,36]]){const a=this.attrs[n];if(a>=0){g.enableVertexAttribArray(a);g.vertexAttribPointer(a,size,g.FLOAT,false,40,off);}}}g.drawArrays(g.TRIANGLES,0,buf.count);this.drawCalls++;}
 render(sim,opt={}){if(this.lost||!this.visible||document.hidden)return;const now=performance.now(),dt=this.last?Math.min(.3,(now-this.last)/1000):.016;this.last=now;this.frames++;this.selected=opt.selected??this.selected;
  if(this.oldIntro!==!!opt.intro){this.oldIntro=!!opt.intro;this.setView('model');if(opt.intro){Object.assign(this.target,{r:this.w<650?280:255,elev:.74,yaw:.15});Object.assign(this.camera,this.target);}}
  if(this.stageId!==sim.stage.id){this.stageId=sim.stage.id;if(!opt.intro)this.setView('model',this.selected);}
  const key=JSON.stringify(sim.config.junctions.map(j=>[j.pocket,j.flyover,j.rightArrow]));if(key!==this.configKey){this.configKey=key;this.buildRoads(sim);}
  this.buildActors(sim,opt);
  if(this.mode==='follow'&&this.cars.length){let car=this.cars.find(a=>a.c.id===this.followId);if(!car){const node=world(E.POINTS[this.selected+1]);car=[...this.cars].sort((a,b)=>(Math.hypot(a.p.x-node[0],a.p.z-node[2])+(a.c.bus?-8:0))-(Math.hypot(b.p.x-node[0],b.p.z-node[2])+(b.c.bus?-8:0)))[0];this.followId=car.c.id;}
   const p=car.p;let yaw=Math.atan2(-p.dx,-p.dz);while(yaw-this.camera.yaw>Math.PI)yaw-=TAU;while(yaw-this.camera.yaw< -Math.PI)yaw+=TAU;Object.assign(this.target,{x:p.x+p.dx*2.5,y:p.y+.6,z:p.z+p.dz*2.5,yaw,elev:clamp(.25-Math.atan(p.slope||0)*.8,.10,.85)});
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(opt.intro&&!reduced&&!this.pointers.size&&(!this.lastInteraction||now-this.lastInteraction>4000))this.target.yaw+=dt*.012;
  const k=reduced?1:1-Math.exp(-dt*6.5);for(const n of Object.keys(this.camera))this.camera[n]=mix(this.camera[n],this.target[n],k);
  const c=this.camera,ce=Math.cos(c.elev);this.eye=[c.x+Math.sin(c.yaw)*ce*c.r,c.y+Math.sin(c.elev)*c.r,c.z+Math.cos(c.yaw)*ce*c.r];this.vp=matmul(perspective(c.fov,this.w/this.h,.1,650),look(this.eye,[c.x,c.y,c.z]));
  const g=this.gl;g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.disable(g.BLEND);g.disable(g.CULL_FACE);this.drawCalls=0;
  if(this.shadowDirty&&this.shadows){g.bindFramebuffer(g.FRAMEBUFFER,this.fbo);g.viewport(0,0,this.shadowSize,this.shadowSize);g.clearColor(1,1,1,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.depthProgram);g.uniformMatrix4fv(this.dloc,false,this.lightVP);for(const a of Object.values(this.attrs))if(a>=0)g.disableVertexAttribArray(a);this.draw(this.buffers.world,true);this.draw(this.buffers.roads,true);this.shadowDirty=false;g.bindFramebuffer(g.FRAMEBUFFER,null);}
  g.viewport(0,0,this.canvas.width,this.canvas.height);const sky=rgb(C.paper);g.clearColor(...sky,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);g.uniformMatrix4fv(this.loc.uVP,false,this.vp);g.uniformMatrix4fv(this.loc.uLight,false,this.lightVP);g.uniform3fv(this.loc.uSun,this.sun);g.uniform3fv(this.loc.uEye,this.eye);g.uniform3fv(this.loc.uSky,sky);g.uniform1f(this.loc.uShadowSize,this.shadowSize);g.uniform1f(this.loc.uShadows,this.shadows?1:0);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.shadowTex);g.uniform1i(this.loc.uShadow,0);this.draw(this.buffers.world);this.draw(this.buffers.roads);this.draw(this.buffers.actors);
  if(!opt.intro)this.updatePins(sim,opt);this.lastSim=sim;
 }
 info(){return {renderer:'HODOKU native WebGL 3D',mode:this.mode,carCount:this.lastCarCount,elevatedCars:this.lastElevated,triangles:Math.round(Object.values(this.buffers).reduce((a,b)=>a+b.count,0)/3),drawCalls:this.drawCalls,shadows:this.shadows,contextLost:this.lost,camera:{...this.camera},viewport:[this.canvas.width,this.canvas.height],followId:this.followId,frames:this.frames};}
}
const Legacy=root.HODOKU_ATLAS;
root.HODOKU_ATLAS=function(canvas){try{return new Diorama(canvas);}catch(e){console.warn('3D rendering unavailable:',e.message);const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);const fallback=new Legacy(replacement);fallback.setView=fallback.zoom=fallback.select=()=>{};fallback.info=()=>({renderer:'2D fallback',reason:e.message});root.HODOKU_VIEW=fallback;document.documentElement.classList.add('fallback-2d');const el=document.getElementById('view-message');if(el){el.textContent='この環境では3D描画を利用できないため、2Dで表示しています。WebGL対応ブラウザで3D版を遊べます。';el.classList.add('visible');}return fallback;}};
})(globalThis);
