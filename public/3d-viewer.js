(() => {
  'use strict';
  const canvas = document.getElementById('viewer');
  const status = document.getElementById('status');
  const variant = document.getElementById('variant');
  const animationButton = document.getElementById('animate');
  const stage = document.querySelector('main');
  const stem = stage.dataset.modelStem;
  const prefix = '/models/original/' + stem;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power'
  });
  const MAX_FILE = 8 * 1024 * 1024;
  const MAX_VERTICES = 160000;
  let resource = null;
  let currentController = null;
  let frame = 0;
  let playing = false;
  let clockStart = 0;
  let clockElapsed = 0;
  let orbit = { yaw: 0.7, pitch: -0.5, distance: 5.4 };
  const touches = new Map();
  let previousDistance = null;

  function inform(message) { status.textContent = message; }
  if (!gl) { inform('WebGL2 unavailable. The app keeps its static fallback.'); return; }

  const vert = '#version 300 es\nprecision highp float;\nlayout(location=0) in vec3 aPosition;\nlayout(location=1) in vec3 aNormal;\nlayout(location=2) in vec4 aColor;\nuniform mat4 uWorld, uProjection;\nuniform vec3 uCenter;\nuniform float uScale, uYaw, uPitch, uDistance;\nuniform vec4 uBaseColor;\nout vec4 vColor;\nvoid main(){\nvec3 p=(uWorld*vec4(aPosition,1.0)).xyz;\np=(p-uCenter)*uScale;\nfloat c=cos(uYaw),s=sin(uYaw),a=cos(uPitch),b=sin(uPitch);\np=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);\np=vec3(p.x,a*p.y-b*p.z,b*p.y+a*p.z);\nvec3 normal=normalize(mat3(uWorld)*aNormal);\nnormal=normalize(vec3(c*normal.x+s*normal.z,normal.y,-s*normal.x+c*normal.z));\nnormal=normalize(vec3(normal.x,a*normal.y-b*normal.z,b*normal.y+a*normal.z));\nfloat lit=0.45+0.55*max(0.0,dot(normal,normalize(vec3(-0.4,0.8,0.7))));\nvColor=vec4(clamp(aColor.rgb*uBaseColor.rgb*lit,0.0,1.0),aColor.a*uBaseColor.a);\ngl_Position=uProjection*vec4(p.x,p.y,p.z-uDistance,1.0);\n}';
  const frag = '#version 300 es\nprecision highp float;\nin vec4 vColor;\nout vec4 pixel;\nvoid main(){pixel=vColor;}';
  function shader(type, source) {
    const item = gl.createShader(type);
    gl.shaderSource(item, source);
    gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(item));
    return item;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vert));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  } catch (error) { inform('Preview shader unavailable: ' + error.message); return; }
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  const uniforms = {};
  for (const name of ['uWorld','uProjection','uCenter','uScale','uYaw','uPitch','uDistance','uBaseColor']) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  function multiply(a,b) {
    const out = new Array(16);
    for(let col=0;col<4;col++) for(let row=0;row<4;row++) {
      let value=0;
      for(let k=0;k<4;k++) value+=a[k*4+row]*b[col*4+k];
      out[col*4+row]=value;
    }
    return out;
  }
  function nodeMatrix(node) {
    if(node.matrix) return node.matrix;
    const [x,y,z,w]=node.rotation||[0,0,0,1];
    const [sx,sy,sz]=node.scale||[1,1,1];
    const [tx,ty,tz]=node.translation||[0,0,0];
    return [
      (1-2*(y*y+z*z))*sx, (2*(x*y+z*w))*sx, (2*(x*z-y*w))*sx, 0,
      (2*(x*y-z*w))*sy, (1-2*(x*x+z*z))*sy, (2*(y*z+x*w))*sy, 0,
      (2*(x*z+y*w))*sz, (2*(y*z-x*w))*sz, (1-2*(x*x+y*y))*sz, 0,
      tx,ty,tz,1
    ];
  }
  function transform(m,p) {
    return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
            m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
            m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
  }
  function readGlb(array) {
    if(array.byteLength<28||array.byteLength>MAX_FILE) throw Error('Asset exceeds size budget or is truncated.');
    const v=new DataView(array);
    if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==array.byteLength) throw Error('Not a GLB 2.0 asset.');
    const jlen=v.getUint32(12,true);
    if(jlen>1024*1024||jlen%4!==0||v.getUint32(16,true)!==0x4e4f534a) throw Error('Invalid JSON chunk.');
    const offset=20+jlen;
    if(offset+8>array.byteLength) throw Error('Missing embedded mesh data.');
    const blen=v.getUint32(offset,true);
    if(v.getUint32(offset+4,true)!==0x004e4942||offset+8+blen!==array.byteLength) throw Error('Invalid binary chunk.');
    const json=JSON.parse(new TextDecoder().decode(new Uint8Array(array,20,jlen)));
    if(json.asset?.version!=='2.0'||!json.scenes?.length||!json.nodes?.length||!json.meshes?.length) throw Error('Invalid scene graph.');
    if((json.extensionsRequired||[]).length) throw Error('This asset uses an unsupported mandatory extension.');
    for(const entry of [...(json.buffers||[]),...(json.images||[])]) {
      if(entry.uri && !entry.uri.startsWith('data:')) throw Error('External resources are not allowed.');
    }
    if(json.buffers?.length!==1||json.buffers[0].byteLength>blen) throw Error('Unsupported binary buffer.');
    for(const view of json.bufferViews||[]) {
      const end=(view.byteOffset||0)+view.byteLength;
      if(view.buffer!==0||end>blen||end<0) throw Error('Asset buffer bounds invalid.');
    }
    const counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const bytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
    function getAccessor(index) {
      const a=json.accessors?.[index];
      const view=json.bufferViews?.[a?.bufferView];
      if(!a||!view||!counts[a.type]||!bytes[a.componentType]||!Number.isSafeInteger(a.count)) throw Error('Unsupported accessor.');
      const width=bytes[a.componentType]*counts[a.type];
      const stride=view.byteStride||width;
      const beginning=(a.byteOffset||0);
      if(beginning<0||stride<width||beginning+(a.count-1)*stride+width>view.byteLength) throw Error('Accessor exceeds buffer bounds.');
      return { a,view,width,stride,offset:(view.byteOffset||0)+beginning };
    }
    function values(index) {
      const {a,stride,offset}=getAccessor(index);
      if(a.componentType!==5126) throw Error('Animation must use floating-point values.');
      const dim=counts[a.type], data=[];
      for(let i=0;i<a.count;i++) for(let j=0;j<dim;j++) data.push(v.getFloat32(28+jlen+offset+i*stride+j*4,true));
      return data;
    }
    const vertexBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(array,28+jlen,blen),gl.STATIC_DRAW);
    const elementBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(array,28+jlen,blen),gl.STATIC_DRAW);
    const meshes=[];
    let totalPositions=0;
    for(const mesh of json.meshes) {
      const parts=[];
      for(const prim of mesh.primitives||[]) {
        if((prim.mode??4)!==4) throw Error('Only triangle meshes are supported.');
        const position=getAccessor(prim.attributes?.POSITION);
        if(position.a.type!=='VEC3') throw Error('Position format unsupported.');
        totalPositions+=position.a.count;
        if(totalPositions>MAX_VERTICES) throw Error('Asset exceeds geometry budget.');
        const vao=gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
        for(const [slot,semantic] of [[0,'POSITION'],[1,'NORMAL'],[2,'COLOR_0']]) {
          if(prim.attributes?.[semantic]===undefined) {
            gl.disableVertexAttribArray(slot);
            if(slot===1) gl.vertexAttrib3f(slot,0,1,0);
            if(slot===2) gl.vertexAttrib4f(slot,1,1,1,1);
            continue;
          }
          const attr=getAccessor(prim.attributes[semantic]);
          if(slot===0 && attr.a.type!=='VEC3') throw Error('Positions must be VEC3.');
          if(slot===1 && attr.a.type!=='VEC3') throw Error('Normals must be VEC3.');
          if(slot===2 && !['VEC3','VEC4'].includes(attr.a.type)) throw Error('Vertex colour unsupported.');
          if(attr.a.count!==position.a.count) throw Error('Mesh attribute count mismatch.');
          gl.enableVertexAttribArray(slot);
          gl.vertexAttribPointer(slot,counts[attr.a.type],attr.a.componentType,!!attr.a.normalized,attr.stride,attr.offset);
        }
        let indexed=false,indexType=null,indexOffset=0,elementCount=position.a.count;
        if(prim.indices!==undefined) {
          const inds=getAccessor(prim.indices);
          if(inds.a.type!=='SCALAR'||![5121,5123,5125].includes(inds.a.componentType)) throw Error('Invalid indices.');
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elementBuffer);
          indexed=true;indexType=inds.a.componentType;indexOffset=inds.offset;elementCount=inds.a.count;
        }
        const color=json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
        parts.push({vao,indexed,indexType,indexOffset,elementCount,bounds:[position.a.min,position.a.max],color});
      }
      meshes.push(parts);
    }
    gl.bindVertexArray(null);
    const instances=[];
    const roots=json.scenes[json.scene||0]?.nodes||[];
    const visit=(index,parent,depth,path)=>{
      if(depth>48||path.includes(index)) throw Error('Invalid cyclic model nodes.');
      const node=json.nodes[index];
      if(!node) throw Error('Missing model node.');
      const world=multiply(parent,nodeMatrix(node));
      if(node.mesh!==undefined) {
        if(!meshes[node.mesh]) throw Error('Missing model mesh.');
        instances.push({index,parts:meshes[node.mesh],matrix:world});
      }
      for(const child of node.children||[]) visit(child,world,depth+1,[...path,index]);
    };
    for(const node of roots) visit(node,identity(),0,[]);
    if(!instances.length) throw Error('No renderable scene nodes.');
    const initial=json.nodes.map(node=>({
      translation:[...(node.translation||[0,0,0])],
      rotation:[...(node.rotation||[0,0,0,1])],
      scale:[...(node.scale||[1,1,1])]
    }));
    const clips=[];
    for(const animation of json.animations||[]) {
      const channels=[];
      for(const channel of animation.channels||[]) {
        const sampler=animation.samplers[channel.sampler];
        if(!sampler||!['translation','rotation','scale'].includes(channel.target.path)||(sampler.interpolation||'LINEAR')!=='LINEAR') continue;
        const times=values(sampler.input),points=values(sampler.output),size=channel.target.path==='rotation'?4:3;
        if(points.length!==times.length*size||!json.nodes[channel.target.node]) throw Error('Invalid animation data.');
        channels.push({node:channel.target.node,path:channel.target.path,times,points,size});
      }
      if(channels.length) clips.push({name:animation.name||'Animation',channels});
    }
    let low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    for(const inst of instances) for(const part of inst.parts) {
      const [min,max]=part.bounds;
      if(!min||!max) throw Error('Geometry must provide position bounds.');
      for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]) {
        const p=transform(inst.matrix,[x,y,z]);
        for(let k=0;k<3;k++) {low[k]=Math.min(low[k],p[k]);high[k]=Math.max(high[k],p[k]);}
      }
    }
    return {json,meshes,instances,initial,clips,low,high,vertexBuffer,elementBuffer};
  }

  function disposeResource() {
    if(!resource)return;
    const created = new Set();
    for(const mesh of resource.meshes)for(const part of mesh) {
      if(!created.has(part.vao)) {gl.deleteVertexArray(part.vao); created.add(part.vao);}
    }
    gl.deleteBuffer(resource.vertexBuffer);
    gl.deleteBuffer(resource.elementBuffer);
  }

  function updatePose(seconds) {
    if(!resource) return;
    const nodes=resource.json.nodes;
    for(let i=0;i<nodes.length;i++) {
      if(nodes[i].matrix) continue;
      nodes[i].translation=[...resource.initial[i].translation];
      nodes[i].rotation=[...resource.initial[i].rotation];
      nodes[i].scale=[...resource.initial[i].scale];
    }
    for(const clip of resource.clips) for(const channel of clip.channels) {
      const {times,points,size,node,path}=channel;
      if(!times.length) continue;
      const duration=times[times.length-1];
      const time=duration>0?seconds%duration:0;
      let i=0;
      while(i+1<times.length-1&&times[i+1]<time) i++;
      const j=Math.min(i+1,times.length-1);
      const span=times[j]-times[i];
      const a=span>0?Math.max(0,Math.min(1,(time-times[i])/span)):0;
      let p=points.slice(i*size,i*size+size),q=points.slice(j*size,j*size+size);
      if(path==='rotation') {
        const dot=p.reduce((sum,n,k)=>sum+n*q[k],0);
        if(dot<0)q=q.map(v=>-v);
      }
      let value=p.map((n,k)=>n+(q[k]-n)*a);
      if(path==='rotation') {
        const length=Math.hypot(...value)||1;
        value=value.map(n=>n/length);
      }
      nodes[node][path]=value;
    }
    const visit=(index,parent,path)=>{
      if(path.includes(index)) return;
      const m=multiply(parent,nodeMatrix(nodes[index]));
      for(const inst of resource.instances)if(inst.index===index)inst.matrix=m;
      for(const child of nodes[index].children||[])visit(child,m,[...path,index]);
    };
    for(const root of resource.json.scenes[resource.json.scene||0].nodes||[])visit(root,identity(),[]);
  }

  function draw() {
    if(!resource)return;
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    const d=Math.min(1.6,window.devicePixelRatio||1,1440/w);
    const cw=Math.ceil(w*d),ch=Math.ceil(h*d);
    if(canvas.width!==cw||canvas.height!==ch) {canvas.width=cw;canvas.height=ch;}
    gl.viewport(0,0,cw,ch);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    const aspect=cw/ch,near=0.1,far=80,f=1/Math.tan(37*Math.PI/360);
    gl.uniformMatrix4fv(uniforms.uProjection,false,new Float32Array([
      f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0
    ]));
    const min=resource.low,max=resource.high;
    const extent=Math.max(...max.map((v,i)=>v-min[i]),0.01);
    gl.uniform3fv(uniforms.uCenter,new Float32Array(min.map((v,i)=>(v+max[i])/2)));
    gl.uniform1f(uniforms.uScale,2.6/extent);
    gl.uniform1f(uniforms.uYaw,orbit.yaw);
    gl.uniform1f(uniforms.uPitch,orbit.pitch);
    gl.uniform1f(uniforms.uDistance,orbit.distance);
    for(const inst of resource.instances) {
      gl.uniformMatrix4fv(uniforms.uWorld,false,new Float32Array(inst.matrix));
      for(const part of inst.parts) {
        gl.uniform4fv(uniforms.uBaseColor,new Float32Array(part.color));
        gl.bindVertexArray(part.vao);
        if(part.indexed) gl.drawElements(gl.TRIANGLES,part.elementCount,part.indexType,part.indexOffset);
        else gl.drawArrays(gl.TRIANGLES,0,part.elementCount);
      }
    }
    gl.bindVertexArray(null);
  }
  function stopAnimation() {
    if(frame) cancelAnimationFrame(frame);
    frame=0;
  }
  function startAnimation() {
    if(!playing||document.hidden||frame||!resource||!resource.clips.length)return;
    frame=requestAnimationFrame(tick);
  }
  function tick(now) {
    frame=0;
    if(!playing||document.hidden)return;
    clockElapsed=(now-clockStart)/1000;
    updatePose(clockElapsed);
    draw();
    startAnimation();
  }
  function updatePlayButton() {
    animationButton.disabled=!resource?.clips.length||preference.matches;
    animationButton.setAttribute('aria-pressed',String(playing));
    animationButton.textContent=preference.matches?'Reduced motion':playing?'Pause animation':'Play animation';
  }
  function setPlaying(next) {
    if(!resource?.clips.length||preference.matches)next=false;
    if(playing) clockElapsed=Math.max(0,(performance.now()-clockStart)/1000);
    playing=next;
    stopAnimation();
    if(playing)clockStart=performance.now()-clockElapsed*1000;
    else {updatePose(clockElapsed);draw();}
    updatePlayButton();
    startAnimation();
  }
  async function changeVariant() {
    setPlaying(false);
    disposeResource();
    resource=null;
    if(currentController)currentController.abort();
    const controller=new AbortController();
    currentController=controller;
    inform('Loading model…');
    const path=variant.value==='blender'?stage.dataset.blenderSrc:prefix+(variant.value==='animated'?'-animated':'')+'.glb';
    try {
      const response=await fetch(path,{credentials:'same-origin',signal:controller.signal});
      if(!response.ok)throw Error('HTTP '+response.status);
      if(Number(response.headers.get('content-length')||0)>MAX_FILE)throw Error('Model exceeds size budget.');
      const buffer=await response.arrayBuffer();
      if(controller.signal.aborted)return;
      resource=readGlb(buffer);
      clockElapsed=0;
      orbit={yaw:0.7,pitch:-0.5,distance:5.4};
      updatePose(0);draw();
      const total=resource.meshes.reduce((n,mesh)=>n+mesh.length,0);
      inform('Loaded · '+total+' mesh '+(total===1?'part':'parts')+' · '+resource.clips.length+' animation clips');
      setPlaying(resource.clips.length>0&&!preference.matches);
    } catch(error) {
      if(error.name!=='AbortError')inform('Preview unavailable: '+error.message);
    }
    updatePlayButton();
  }
  // The browser reads candidate files locally. No remote model upload occurs.
  const candidateInput=document.getElementById('candidate');
  candidateInput.addEventListener('change',async()=>{
    const file=candidateInput.files?.[0];
    if(!file)return;
    setPlaying(false);
    currentController?.abort();
    disposeResource();
    resource=null;
    variant.value='local';
    inform('Opening local review file…');
    try {
      if(!/\.glb$/i.test(file.name))throw Error('Choose a .glb model file.');
      if(file.size<28||file.size>MAX_FILE)throw Error('The GLB exceeds the 8 MiB review limit.');
      const bytes=await file.arrayBuffer();
      resource=readGlb(bytes);
      clockElapsed=0;
      orbit={yaw:0.7,pitch:-0.5,distance:5.4};
      updatePose(0);
      draw();
      const count=resource.meshes.reduce((sum,mesh)=>sum+mesh.length,0);
      inform('Local review · '+count+' mesh parts · '+resource.clips.length+' clips · never uploaded');
      setPlaying(resource.clips.length>0&&!preference.matches);
    } catch(error) {
      inform('Candidate unavailable: '+error.message);
    } finally {
      candidateInput.value='';
      updatePlayButton();
    }
  });
  const clearTouches=()=>{touches.clear();previousDistance=null;};
  canvas.addEventListener('pointerdown',e=>{
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    touches.set(e.pointerId,[e.clientX,e.clientY]);
    previousDistance=null;
  });
  canvas.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    e.preventDefault();
    const old=touches.get(e.pointerId);
    touches.set(e.pointerId,[e.clientX,e.clientY]);
    if(touches.size>=2) {
      const p=[...touches.values()];
      const distance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);
      if(previousDistance!==null)orbit.distance=Math.max(2.5,Math.min(12,orbit.distance*previousDistance/distance));
      previousDistance=distance;
    } else {
      orbit.yaw+=(e.clientX-old[0])*0.009;
      orbit.pitch=Math.max(-1.35,Math.min(1.35,orbit.pitch+(e.clientY-old[1])*0.006));
    }
    draw();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,e=>{
    touches.delete(e.pointerId);previousDistance=null;
  });
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft')orbit.yaw-=0.14;
    if(e.key==='ArrowRight')orbit.yaw+=0.14;
    if(e.key==='ArrowUp')orbit.pitch=Math.min(1.35,orbit.pitch+0.1);
    if(e.key==='ArrowDown')orbit.pitch=Math.max(-1.35,orbit.pitch-0.1);
    if(e.key==='+')orbit.distance=Math.max(2.5,orbit.distance-0.4);
    if(e.key==='-')orbit.distance=Math.min(12,orbit.distance+0.4);
    draw();
  });
  document.getElementById('reset').addEventListener('click',()=>{
    orbit={yaw:0.7,pitch:-0.5,distance:5.4};clockElapsed=0;
    if(playing)clockStart=performance.now();
    updatePose(0);draw();canvas.focus();
  });
  document.getElementById('top').addEventListener('click',()=>{orbit.pitch=-1.35;draw();canvas.focus();});
  document.getElementById('zoom').addEventListener('click',()=>{orbit.distance=Math.max(2.5,orbit.distance-0.45);draw();canvas.focus();});
  document.getElementById('save').addEventListener('click',()=>{
    if(!resource){inform('Model not loaded');return;}
    draw();
    canvas.toBlob(blob=>{
      if(!blob){inform('PNG export failed');return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=stem+'-'+variant.value+'.png';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    },'image/png');
  });
  animationButton.addEventListener('click',()=>setPlaying(!playing));
  variant.addEventListener('change',changeVariant);
  document.addEventListener('visibilitychange',()=>{stopAnimation();if(!document.hidden&&playing){clockStart=performance.now()-clockElapsed*1000;startAnimation();}});
  preference.addEventListener('change',()=>setPlaying(!preference.matches&&!!resource?.clips.length));
  window.addEventListener('pagehide',()=>{stopAnimation();currentController?.abort();disposeResource();resource=null;clearTouches();});
  if('ResizeObserver'in window)new ResizeObserver(draw).observe(canvas);
  else window.addEventListener('resize',draw);
  void changeVariant();
})();