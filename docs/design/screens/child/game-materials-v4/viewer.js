import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Atmosphere} from './atmosphere.js';
const $=s=>document.querySelector(s),stage=$('#stage'),status=$('#status');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.outputColorSpace=THREE.SRGBColorSpace;stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#cbdad6');
const camera=new THREE.PerspectiveCamera(34,1,.1,60);camera.position.set(1,3.4,11.8);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.6,0);
controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=16;controls.maxPolarAngle=Math.PI*.49;
const hemi=new THREE.HemisphereLight('#d6efff','#a88b62',1.8);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d1',1.25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;
scene.add(sun);scene.add(sun.target);
const fill=new THREE.DirectionalLight('#fff5e2',1.15);fill.position.set(0,4,7);scene.add(fill);
const lamp=new THREE.PointLight('#ffba69',0,7,2);lamp.position.set(-1.6,2,1.1);scene.add(lamp);
const atmosphere=new Atmosphere(scene,{sun,hemi,fill,lamp});
const loader=new GLTFLoader(),mixers=new Set(),finishHandlers=new WeakMap();
let room,roomMixer,roomClips=[],elapsed=0,lastPetAction=0;
const actors={pet:{root:null,mixer:null,clips:[],request:0,key:'cat',idle:'sleep_loop'},character:{root:null,mixer:null,clips:[],request:0,key:'girl',idle:'read_idle'}};
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;$('#reduce').checked=reduced;
function clean(n){return n.replaceAll('_','-').toLowerCase()}
function styleModel(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())}})}
function findRig(root,prefix){let found;root.traverse(o=>{if(clean(o.name).startsWith(prefix)&&clean(o.name).endsWith('rig'))found=o});return found}
function loop(actor){const clip=actor.clips.find(c=>c.name===actor.idle);if(!clip)return;const a=actor.mixer.clipAction(clip);a.reset().setLoop(THREE.LoopRepeat,Infinity).fadeIn(.25).play()}
function once(actor,name){
  if(!actor.mixer||!actor.root?.visible||reduced)return;
  const clip=actor.clips.find(c=>c.name===name);if(!clip)return;
  const mixer=actor.mixer,previous=finishHandlers.get(mixer);if(previous)mixer.removeEventListener('finished',previous);
  for(const c of actor.clips)mixer.clipAction(c).fadeOut(.2);
  const a=mixer.clipAction(clip);a.reset().setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.fadeIn(.2).play();
  const finish=e=>{if(e.action!==a)return;mixer.removeEventListener('finished',finish);finishHandlers.delete(mixer);a.fadeOut(.25);loop(actor)};
  finishHandlers.set(mixer,finish);mixer.addEventListener('finished',finish);if(actor===actors.pet)lastPetAction=elapsed;
}
function stopActor(actor){if(!actor.mixer)return;const f=finishHandlers.get(actor.mixer);if(f)actor.mixer.removeEventListener('finished',f);actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.root);mixers.delete(actor.mixer)}
function disposeModel(root,materialsToo=true){
  const textures=new Set(),materials=new Set(),geometries=new Set(),skeletons=new Set();
  root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});
  if(materialsToo){materials.forEach(m=>{for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose()});textures.forEach(t=>t.dispose())}
  geometries.forEach(g=>g.dispose());skeletons.forEach(s=>s.dispose());
}
async function choose(type,key){
  const actor=actors[type];if(!actor)throw new Error('Bilinmeyen model türü');
  const allowed=type==='pet'?['cat','dog','monkey','lion','none']:['girl','boy','unspecified'];if(!allowed.includes(key))throw new Error('Bilinmeyen model');
  const request=++actor.request;
  if(key==='none'){actor.key=key;if(actor.root)actor.root.visible=false;return}
  const g=await loader.loadAsync('models/'+(type==='pet'?'pet-':'character-')+key+'.glb');
  if(request!==actor.request){disposeModel(g.scene);return}
  stopActor(actor);if(actor.root){actor.root.parent?.remove(actor.root);disposeModel(actor.root,!!actor.root.userData.externalAsset)}
  actor.root=g.scene;actor.root.userData.externalAsset=true;actor.key=key;styleModel(actor.root);
  actor.root.position.set(type==='pet'?-1.13:0,type==='pet'?.1:.06625,type==='pet'?.98:.72);actor.root.scale.setScalar(type==='pet'?1:1.35);
  scene.add(actor.root);actor.mixer=new THREE.AnimationMixer(actor.root);actor.clips=g.animations;mixers.add(actor.mixer);loop(actor);$('#'+type).value=key;
}
function resize(){const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.zoom=Math.min(1,camera.aspect/1.05);camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);
window.ready=(async()=>{
  const g=await loader.loadAsync('gina-room-reference.glb');room=g.scene;styleModel(room);scene.add(room);
  room.traverse(o=>{if(/Sky.outside|Sun.or.moon.outside/i.test(o.name))o.visible=false});
  for(const [type,actor] of Object.entries(actors)){
    actor.root=findRig(room,type==='pet'?'pet-cat':'character-girl');
    if(!actor.root)throw new Error('Eksik rig: '+type);
    actor.clips=g.animations.filter(c=>(type==='pet'?/sleep|yawn|play|look_at/:/read_idle|look_up/).test(c.name));
    actor.mixer=new THREE.AnimationMixer(actor.root);mixers.add(actor.mixer);loop(actor);
  }
  roomClips=g.animations.filter(c=>/drawer|book_open/.test(c.name));roomMixer=new THREE.AnimationMixer(room);mixers.add(roomMixer);
  const params=new URLSearchParams(location.search),p=params.get('phase')||'day',w=params.get('weather')||'clear';
  try{atmosphere.set(p,w,true);$('#phase').value=p;$('#weather').value=w}catch{atmosphere.set('day','clear',true)}
  status.textContent=atmosphere.label();return {clips:g.animations.map(c=>c.name)};
})().catch(e=>{status.textContent='Model yüklenemedi: '+e.message;throw e});
function playRoom(name){if(reduced||!roomMixer)return;const c=roomClips.find(c=>c.name===name);if(c){const a=roomMixer.clipAction(c);a.reset().setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play()}}
for(const id of ['phase','weather'])$('#'+id).onchange=()=>{atmosphere.set($('#phase').value,$('#weather').value,reduced);status.textContent=atmosphere.label()};
$('#wind').oninput=e=>atmosphere.wind=Number(e.target.value);
for(const id of ['pet','character'])$('#'+id).onchange=e=>choose(id,e.target.value).catch(e=>status.textContent='Model yüklenemedi: '+e.message);
$('#yawn').onclick=()=>once(actors.pet,'yawn_stretch');$('#play').onclick=()=>once(actors.pet,'play_tap');
$('#look').onclick=()=>once(actors.character,'look_up');$('#drawer').onclick=()=>playRoom('drawer_open_close');$('#book').onclick=()=>playRoom('book_open_close');
$('#reduce').onchange=e=>reduced=e.target.checked;
$('#reset').onclick=()=>{camera.position.set(1,3.4,11.8);controls.target.set(0,1.6,0);controls.update()};
// Tapping the pet uses a scene raycast, no HTML hitbox placed on its picture.
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);if(actors.pet.root?.visible&&ray.intersectObject(actors.pet.root,true).length)once(actors.pet,'look_at_touch')});
let last=performance.now();function frame(now){
  requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;if(document.hidden)return;
  controls.update();atmosphere.update(dt,reduced);
  if(!reduced){elapsed+=dt;for(const m of mixers)m.update(dt);if($('#ambient').checked&&elapsed-lastPetAction>45)once(actors.pet,'yawn_stretch')}
  renderer.render(scene,camera);
}requestAnimationFrame(frame);
window.review={
  set:async(p,w,immediate=false)=>{await window.ready;atmosphere.set(p,w,immediate);$('#phase').value=p;$('#weather').value=w;status.textContent=atmosphere.label()},choose,
  stats:()=>({memory:{...renderer.info.memory},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,phase:atmosphere.phase,weather:atmosphere.weather,reduced,pet:actors.pet.key,character:actors.character.key,petClips:actors.pet.clips.map(c=>c.name),childClips:actors.character.clips.map(c=>c.name),roomClips:roomClips.map(c=>c.name)}),
  animatePet:n=>once(actors.pet,n),animateRoom:playRoom,
  snapshot:()=>({petTime:actors.pet.mixer?.time,weatherTime:atmosphere.time,petPosition:actors.pet.root?.position.toArray(),characterPosition:actors.character.root?.position.toArray()})
};
