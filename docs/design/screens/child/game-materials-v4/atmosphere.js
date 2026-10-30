import * as THREE from 'three';

// Art-directed review presets. This module does not infer location or request weather.
export const phases = {
  sunrise:{label:'Gün doğumu',top:'#a0b8d4',bottom:'#ffc395',light:'#ffc18c',pos:[-5,2,-4],sun:[-.42,2.4,-2.17],power:1.35,ambient:1.2,fill:.8,bg:'#d7c5b5'},
  day:{label:'Gündüz',top:'#9fdaf1',bottom:'#e5f1dc',light:'#fff1d8',pos:[-3,6,-2],sun:[.32,2.8,-2.17],power:1.25,ambient:1.8,fill:1.15,bg:'#cbdad6'},
  sunset:{label:'Gün batımı',top:'#777eb2',bottom:'#ffb080',light:'#ffad78',pos:[5,1.8,-4],sun:[-.05,2.4,-2.17],power:1.35,ambient:1.05,fill:.8,bg:'#c8b3b2'},
  night:{label:'Gece',top:'#17273f',bottom:'#455778',light:'#93b7e8',pos:[2,5,-3],sun:[.27,2.88,-2.17],power:.35,ambient:.7,fill:.6,bg:'#263748'}
};
export const weathers = {clear:'Açık',cloudy:'Bulutlu',rain:'Yağmur',snow:'Kar',wind:'Rüzgâr',fog:'Sis'};

export class Atmosphere {
  constructor(scene,{sun,hemi,fill,lamp}) {
    Object.assign(this,{scene,sun,hemi,fill,lamp,phase:'day',weather:'clear',wind:.2,time:0});
    this.skyMat=new THREE.ShaderMaterial({
      uniforms:{top:{value:new THREE.Color()},bottom:{value:new THREE.Color()},haze:{value:0},warmth:{value:0},sunUv:{value:new THREE.Vector2(.5,.5)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform vec3 top,bottom;uniform float haze,warmth;uniform vec2 sunUv;varying vec2 vUv;
        void main(){vec3 c=mix(bottom,top,smoothstep(0.,1.,vUv.y));
        float glow=exp(-length((vUv-sunUv)*vec2(1.,1.4))*4.5)*warmth;
        c=mix(c,vec3(1.,.52,.22),glow*.38);c=mix(c,vec3(.40,.48,.53),haze*.65);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
    });
    const sky=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.02),this.skyMat);sky.position.set(0,2.22,-2.21);scene.add(sky);
    this.celestial=new THREE.Mesh(new THREE.SphereGeometry(.18,28,18),new THREE.MeshBasicMaterial({color:'#ffe0a2'}));
    this.celestial.scale.z=.16;scene.add(this.celestial);
    this.stars=new THREE.Group();const starMat=new THREE.MeshBasicMaterial({color:'#fff5d4'}),starGeo=new THREE.SphereGeometry(.007,6,4);
    for(let i=0;i<26;i++){const s=new THREE.Mesh(starGeo,starMat);s.position.set(-.62+(i*37%101)/101*1.24,1.35+(i*41%97)/97*1.8,-2.18);this.stars.add(s)}scene.add(this.stars);
    this.clouds=new THREE.Group();this.cloudMat=new THREE.MeshStandardMaterial({color:'#f8fcff',roughness:1});
    for(let i=0;i<6;i++){const o=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),this.cloudMat);o.scale.set(1,.55,.2);o.position.set(-.3+i*.11,2.9+(i%2)*.05,-2.12);this.clouds.add(o)}scene.add(this.clouds);
    // Trees are real geometry outside the wall, behind window trim and furniture.
    this.trees=new THREE.Group();this.treeMat=new THREE.MeshStandardMaterial({color:'#77a795',roughness:1});
    const treeGeo=new THREE.SphereGeometry(.18,12,10);
    for(let i=0;i<6;i++){const t=new THREE.Mesh(treeGeo,this.treeMat);t.scale.set(1,1.7,.1);t.position.set(-.62+i*.24,1.24+(i%3)*.12,-2.19);this.trees.add(t)}scene.add(this.trees);
    this.count=220;this.seeds=Array.from({length:this.count},(_,i)=>({x:(i*79%223)/223,y:(i*131%227)/227,z:(i*43%211)/211}));
    this.rainPositions=new Float32Array(this.count*6);const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:'#b5ddeb',transparent:true,opacity:.62}));scene.add(this.rain);
    this.snowPositions=new Float32Array(this.count*3);const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(this.snowPositions,3));
    this.snow=new THREE.Points(sg,new THREE.PointsMaterial({color:'#fffaf2',size:.026,transparent:true,opacity:.92}));scene.add(this.snow);
    this.sillSnow=new THREE.Mesh(new THREE.CapsuleGeometry(.035,1.2,4,16),new THREE.MeshStandardMaterial({color:'#f8fbff',roughness:1}));
    this.sillSnow.rotation.z=Math.PI/2;this.sillSnow.position.set(0,1.24,-2.1);scene.add(this.sillSnow);
    this.leaves=new THREE.Group();const leafGeo=new THREE.SphereGeometry(.035,8,6),leafMats=['#c99c55','#769870'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
    for(let i=0;i<11;i++){const o=new THREE.Mesh(leafGeo,leafMats[i%2]);o.scale.set(.45,1,.12);this.leaves.add(o)}scene.add(this.leaves);
    // Sparse glass droplets catch highlights; they are not a full-screen rain overlay.
    this.drops=new THREE.InstancedMesh(new THREE.SphereGeometry(.009,6,4),new THREE.MeshStandardMaterial({color:'#bddde4',transparent:true,opacity:.5,roughness:.12}),40);
    const dummy=new THREE.Object3D();for(let i=0;i<40;i++){dummy.position.set(-.6+(i*19%43)/43*1.2,1.3+(i*29%47)/47*1.8,-2.08);dummy.scale.set(1,1.5+(i%3),.2);dummy.updateMatrix();this.drops.setMatrixAt(i,dummy.matrix)}scene.add(this.drops);
    this.set('day','clear',true);
  }
  set(phase,weather,immediate=false){
    if(!phases[phase]||!weathers[weather])throw new Error('Bilinmeyen atmosfer seçimi');
    this.phase=phase;this.weather=weather;this.target=phases[phase];
    this.celestial.visible=['clear','wind'].includes(weather);this.stars.visible=phase==='night'&&weather==='clear';this.clouds.visible=weather!=='clear';
    this.rain.visible=this.drops.visible=weather==='rain';this.snow.visible=this.sillSnow.visible=weather==='snow';this.leaves.visible=weather==='wind';
    this.cloudMat.color.set(weather==='rain'?'#7f96a4':weather==='snow'?'#c9d6de':'#e2e8e8');
    this.celestial.material.color.set(phase==='night'?'#ecf4ff':phase==='sunset'?'#ffb46b':'#ffe0a2');
    if(immediate)this.transition(1);
  }
  transition(alpha){
    const p=this.target,c=new THREE.Color(),v=new THREE.Vector3(),u=this.skyMat.uniforms,w=this.weather;
    const mix=(a,b)=>THREE.MathUtils.lerp(a,b,alpha);
    u.top.value.lerp(c.set(p.top),alpha);u.bottom.value.lerp(c.set(p.bottom),alpha);
    u.haze.value=mix(u.haze.value,w==='fog'?.95:w==='cloudy'?.45:w==='rain'?.55:w==='snow'?.48:0);
    u.warmth.value=mix(u.warmth.value,['sunrise','sunset'].includes(this.phase)?1:0);
    this.sun.color.lerp(c.set(p.light),alpha);this.sun.position.lerp(v.set(...p.pos),alpha);
    this.sun.intensity=mix(this.sun.intensity,p.power*(['clear','wind'].includes(w)?1:.4));
    this.hemi.intensity=mix(this.hemi.intensity,p.ambient);this.fill.intensity=mix(this.fill.intensity,p.fill);
    this.lamp.intensity=mix(this.lamp.intensity,this.phase==='night'?7:this.phase==='sunset'?2:0);
    this.scene.background.lerp(c.set(p.bg),alpha);this.celestial.position.lerp(v.set(...p.sun),alpha);
    u.sunUv.value.set((this.celestial.position.x+.7)/1.4,(this.celestial.position.y-1.21)/2.02);
  }
  update(dt,reduced){
    this.transition(reduced?1:1-Math.exp(-dt*2.4));
    if(reduced)return;
    this.time+=dt;const t=this.time,w=this.wind;
    this.clouds.position.x=Math.sin(t*.06*(1+w))*.10;
    this.trees.children.forEach((o,i)=>o.rotation.z=Math.sin(t*1.3+i)*w*.07);
    if(this.rain.visible||this.snow.visible){
      this.seeds.forEach((s,i)=>{const x=-.62+((s.x+t*.045*w)%1)*1.24,y=1.28+((s.y-t*.65+10000)%1)*1.9,z=-2.15+s.z*.025;
        this.rainPositions.set([x,y,z,Math.max(-.65,x-w*.04),Math.min(3.2,y+.10),z],i*6);
        this.snowPositions.set([-.62+((s.x+Math.sin(t*.5+i)*.025+t*.02*w+10000)%1)*1.24,1.28+((s.y-t*.12+10000)%1)*1.9,z],i*3)
      });this.rain.geometry.attributes.position.needsUpdate=true;this.snow.geometry.attributes.position.needsUpdate=true;
    }
    if(this.leaves.visible)this.leaves.children.forEach((o,i)=>{o.position.set(-.6+((i*.17+t*.12*(.3+w))%1)*1.2,1.4+((i*.23+Math.sin(t+i)*.07+2)%1)*1.5,-2.1);o.rotation.z=t+i});
  }
  label(){return phases[this.phase].label+' · '+weathers[this.weather]+' · Manuel önizleme'}
}
