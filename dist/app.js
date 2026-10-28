import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { HeatModel, MATERIALS } from './physics.js';
import { temperatureMaterial } from './temperature-material.js';
import { FLUID_SPECS, FLUID_PROBES, radiationLayout, radiationPosition } from './temperature-field.js';
import { FlowTracers } from './flow-tracers.js';
import { SOLID_SHAPES, PLATE_SIZE, PLATE_WIDTH, solidPosition } from './conduction.js';

const $ = id => document.getElementById(id);
const paths = {
  flask:'M9 3h6M10 3v6l-6 10a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V3M7 16h10M10 18h1',
  help:'M9.5 8a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4M12 17h.01',
  book:'M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4zM13 6a3 3 0 0 1 3-3h5v16h-4a4 4 0 0 0-4 2',
  cube:'m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5',
  drop:'M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13zM8 15a4 4 0 0 0 4 4',
  wind:'M3 8h12c5 0 5-7 1-6M3 12h17c4 0 4 6 0 6M3 16h8c4 0 4 6 0 5',
  sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 1.5 1.5M5 19l1.5-1.5M17.5 6.5 19 5',
  sliders:'M4 7h5M13 7h7M4 17h9M17 17h3M9 4v6M13 7h0M15 14v6',
  play:'m9 5 11 7-11 7z', pause:'M8 5v14M16 5v14', reset:'M3 9a9 9 0 1 1 1 9M3 3v6h6', rotate:'M4 9a8 8 0 0 1 14-3l3 3M21 3v6h-6M20 15a8 8 0 0 1-14 3l-3-3M3 21v-6h6',
  expand:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5', arrow:'M3 12h17M14 6l6 6-6 6',
  dots:'M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01',
  mouse:'M12 2a6 6 0 0 1 6 6v8a6 6 0 0 1-12 0V8a6 6 0 0 1 6-6zM12 5v4',
  spark:'m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z',thought:'M9 18h6M9 21h6M8 15a7 7 0 1 1 8 0l-1 3H9z',
  plus:'M12 5v14M5 12h14',close:'M6 6l12 12M18 6 6 18',download:'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
  thermal:'M5 7h3l2-3h4l2 3h3a2 2 0 0 1 2 2v10H3V9a2 2 0 0 1 2-2M10 10v5a3 3 0 1 0 4 0v-5M12 12v5',leaf:'M20 3C7 1 2 9 6 16c7 7 15-1 14-13zM5 21 16 9'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='help'?'<circle cx="12" cy="12" r="10"/>':name==='sun'?'<circle cx="12" cy="12" r="4"/>':''}<path d="${paths[name]||paths.spark}"/></svg>`;}
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
icons();

const CONTENT={
  solid:{chip:'CONDUCTION',title:'막대의 한쪽 끝을 데워 볼까요?',desc:'가까운 곳부터 온도가 어떻게 달라지는지 살펴보세요.',insight:'물체는 제자리에, 열은 이웃으로.',text:'데운 곳에서 이웃한 부분으로 열이 차례차례 전달돼요. 재료를 바꾸면 열이 퍼지는 빠르기도 달라집니다.',everyday:'뜨거운 국에 넣은 금속 숟가락의 손잡이가 따뜻해져요.',question:'가열하면 어느 곳이 먼저 따뜻해질까요?',answers:['A · 열원 가까이','B · 막대 가운데','C · 열원 멀리'],correct:0,feedback:'열원과 가까운 A에서 시작해 B, C 방향으로 열이 전달돼요.',probes:['A · 가까운 곳','B · 가운데','C · 먼 곳'],short:'고체의 전도'},
  liquid:{chip:'CONVECTION · WATER',title:'데워진 물은 어디로 움직일까요?',desc:'아래쪽과 위쪽을 각각 데워서 물의 흐름을 비교해 보세요.',insight:'따뜻해진 물이 위로, 차가운 물이 아래로.',text:'아래쪽 물을 데우면 밀도가 작아진 물이 올라가요. 주변의 차가운 물이 내려오며 순환하고, 물의 이동과 함께 열이 전달됩니다.',everyday:'냄비 아래를 데우면 물이 순환하며 전체가 따뜻해져요.',question:'물이 잘 순환하게 하려면 어디를 데울까요?',answers:['아래쪽을 데워요','위쪽을 데워요'],correct:0,feedback:'아래를 데우면 따뜻해진 물이 올라가며 순환해요. 위를 데우면 따뜻한 물이 위에 머물러 순환이 약해요.',probes:['A · 아래쪽 물','B · 중간 물','C · 위쪽 물'],short:'액체의 대류'},
  gas:{chip:'CONVECTION · AIR',title:'교실 안 공기도 여행을 해요.',desc:'난방 위치를 바꾸고 따뜻한 공기의 움직임을 따라가 보세요.',insight:'눈에 안 보여도, 공기는 움직이고 있어요.',text:'따뜻해져 밀도가 작아진 공기는 올라가고, 주변의 차가운 공기는 내려와요. 이렇게 공기가 순환하면서 열을 옮깁니다.',everyday:'난방기를 낮은 곳에 두면 따뜻한 공기가 위로 퍼져요.',question:'아래쪽에서 데워진 공기는 어떻게 될까요?',answers:['위로 올라가요','아래로 내려가요','제자리에 머물러요'],correct:0,feedback:'따뜻해져 밀도가 작아진 공기는 주변의 차가운 공기보다 위로 올라가요.',probes:['A · 아래쪽 공기','B · 중간 공기','C · 위쪽 공기'],short:'기체의 대류'},
  radiation:{chip:'RADIATION',title:'닿지 않아도 따뜻해질 수 있어요.',desc:'거리와 표면을 바꾸며 물체가 데워지는 정도를 비교해 보세요.',insight:'열은 물질이 없는 공간도 건너가요.',text:'뜨거운 물체가 내보낸 복사 에너지가 떨어져 있는 물체에 흡수되면 온도가 올라가요. 이 실험에서는 거리와 흡수하는 정도를 바꿀 수 있어요.',everyday:'햇볕을 쬐거나 난로 앞에 서면 따뜻함이 느껴져요.',question:'태양의 열은 우주 공간을 어떻게 건너올까요?',answers:['전도로','대류로','복사로'],correct:2,feedback:'복사는 중간에 물질이 없어도 전달돼요. 태양의 에너지도 복사로 지구에 도달해요.',probes:['A · 열원','B · 받는 물체','C · 주변'],short:'복사'}
};
Object.assign(CONTENT.solid,{question:'전도가 일어날 때 어떤 일이 생길까요?',answers:['열이 이웃으로 전달돼요','고체가 물처럼 흘러가요','빈 공간을 건너뛰어요'],correct:0,feedback:'고체 입자는 제자리에서 진동하고, 열은 이어진 이웃으로 전달돼요. 모양을 바꾸며 열의 길을 찾아보세요.'});
let mode='solid',model=new HeatModel(),running=false,speed=1,thermal=false,lightweight=true,showArrows=true,showParticles=false;
let scene,camera,renderer,orbit,world,grid,floor,particleMesh,flowTracers,particleData=[],rod,fluidField,arrows=[],probePositions=[],heater,surface,barrier;
let ambientMeshes=[],hotMeshes=[],thermalSurfaces=[],history=[],lastHistory=-1,lastUi=0,lastFrame=0,lastSimulationFrame=0,visualTime=0,animationId,notes=[],needsRender=true;
let heaterDrag=null;
const heaterHandle=document.createElement('button');heaterHandle.id='heater-handle';heaterHandle.type='button';heaterHandle.textContent='✥ 열원 이동';heaterHandle.title='마우스로 끌거나 방향키로 열원을 옮겨요';heaterHandle.setAttribute('aria-label','열원 위치 이동. 마우스로 끌거나 방향키를 누르세요.');heaterHandle.hidden=true;$('scene').append(heaterHandle);
const thermalButton=document.createElement('button');thermalButton.id='thermal-view';thermalButton.className='thermal-button';thermalButton.setAttribute('aria-pressed','false');thermalButton.innerHTML=icon('thermal')+'<span>열화상 보기</span>';$('scene').prepend(thermalButton);
const thermalBadge=document.createElement('div');thermalBadge.id='thermal-badge';thermalBadge.innerHTML='<span class="thermal-dot"></span> 열화상 카메라 <b>20–100 °C</b>';$('scene').append(thermalBadge);
const performanceToggle=document.createElement('label');performanceToggle.className='toggle-row performance-toggle';performanceToggle.innerHTML=`<span>${icon('leaf')}크롬북 절전 모드</span><input id="lightweight" type="checkbox" checked><span class="switch"></span>`;document.querySelector('.display-options').append(performanceToggle);
const modeNote=document.createElement('p');modeNote.className='control-note';modeNote.id='performance-note';modeNote.textContent='입자 수와 해상도를 줄여 가볍게 실행해요.';document.querySelector('.display-options').append(modeNote);
const tabNote=document.createElement('p');tabNote.textContent='열화상 색은 모형의 온도와 연결되어 있어요. 물·공기는 내부 흐름을 볼 수 있게 그린 모형 단면이며 실제 카메라 촬영이 아니에요. 실제 카메라는 보통 물 내부나 공기 자체를 이렇게 볼 수 없고, 반짝이는 금속에는 주변 열원이 비칠 수도 있어요. 여기서는 반사 영상 대신 물체의 모형 온도를 표시해요. 반사 가림판은 직접 복사를 완전히 막는 이상적인 판으로, 판의 가열은 생략했어요. 크롬북 절전 모드는 기본으로 켜져 있으며, 다른 탭으로 이동하면 실험이 일시정지됩니다.';document.querySelector('.model-note').append(tabNote);
const particleNote=document.createElement('p');particleNote.textContent='물·공기 입자의 작은 불규칙 운동은 크기를 키우고 느리게 보여 주는 설명용 표현이에요. 실제 입자의 크기·속도·이동 경로와는 달라요. 위를 가열해 큰 대류 순환이 잘 생기지 않아도 입자의 운동은 계속됩니다. 일시정지 버튼은 이 움직임도 함께 멈춰 관찰하게 해 줘요.';document.querySelector('.model-note').append(particleNote);

const cold=new THREE.Color('#74afd0'),warm=new THREE.Color('#72bda6'),yellow=new THREE.Color('#e8cf79'),hot=new THREE.Color('#e3774e');
const thermalStops=['#251259','#532f98','#a33189','#e45057','#fa8b3b','#ffd766','#fff3bd'].map(x=>new THREE.Color(x).convertLinearToSRGB());
function tempColor(t){const v=THREE.MathUtils.clamp((t-20)/80,0,1);if(thermal){let f=v*(thermalStops.length-1),i=Math.min(thermalStops.length-2,Math.floor(f));return thermalStops[i].clone().lerp(thermalStops[i+1],f-i).convertSRGBToLinear();}if(v<.25)return cold.clone().lerp(warm,v*4);if(v<.65)return warm.clone().lerp(yellow,(v-.25)/.4);return yellow.clone().lerp(hot,(v-.65)/.35);}
function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.05,...extra});}
function mesh(geometry,material,pos,parent=world){let m=new THREE.Mesh(geometry,material);m.position.set(...pos);parent.add(m);return m;}
function box(w,h,d,color,x,y,z,options={}){return mesh(new THREE.BoxGeometry(w,h,d),mat(color,options),[x,y,z]);}
function cylinder(rt,rb,h,color,x,y,z,options={}){return mesh(new THREE.CylinderGeometry(rt,rb,h,32),mat(color,options),[x,y,z]);}
function ambient(m){m.userData.normalColor=m.material.color.clone();ambientMeshes.push(m);return m;}
function line(points,color='#a5bcb0',opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));world.add(l);return l;}
function addArrow(start,end,color){const a=new THREE.ArrowHelper(new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize(),new THREE.Vector3(...start),new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end)),color,.15,.085);world.add(a);arrows.push(a);return a;}
function makeHeater(x,y,z,kind='round'){
  const g=new THREE.Group();world.add(g);g.position.set(x,y,z);
  let base=new THREE.Mesh(kind==='round'?new THREE.CylinderGeometry(.55,.63,.15,32):new THREE.BoxGeometry(.85,.18,.6),mat('#5c766d'));base.position.y=.07;g.add(base);ambient(base);
  for(let i=0;i<3;i++){let ring=new THREE.Mesh(new THREE.TorusGeometry(.16+i*.13,.035,8,36),mat('#e58a57',{emissive:'#8e3012',emissiveIntensity:.12}));ring.rotation.x=-Math.PI/2;ring.position.y=.17;g.add(ring);hotMeshes.push(ring);}
  const indicator=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),mat('#e39a61'));indicator.position.set(0,.04,.54);g.add(indicator);return g;
}
function makeParticles(count){
  const convection=mode==='liquid'||mode==='gas';if(convection)count=lightweight?36:60;
  particleData=Array.from({length:count},(_,i)=>({phase:(i/count)*Math.PI*2,ring:.7+(i%5)*.06,z:((i*17)%31/31-.5)*(mode==='liquid'?1.6:2.25),offset:(i*13)%23/23}));
  if(convection){particleMesh=null;flowTracers=new FlowTracers(particleData);world.add(flowTracers);return;}
  const geo=new THREE.SphereGeometry(mode==='solid'?.043:.052,8,6);particleMesh=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color:0xffffff}),count);particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(particleMesh);particleMesh.frustumCulled=false;
}
function heaterRange(){return mode==='liquid'?{bottom:.19,height:2.4}:{bottom:.2,height:2.85};}
function updateHeaterPosition(){
  if(mode!=='liquid'&&mode!=='gas')return;
  const spec=FLUID_SPECS[mode],range=heaterRange();heater.position.set(model.options.heaterX*spec.width/2,range.bottom+model.heatingHeight*range.height,0);
  const top=model.heatingHeight>=.97,substance=mode==='liquid'?'물':'공기',content=CONTENT[mode];
  $('scene-description').textContent=top?'위쪽을 데워도 입자는 움직여요. 큰 순환과 구분해 관찰하세요.':content.desc;
  $('insight-title').textContent=top?'입자는 움직여도, 큰 순환은 약해요.':content.insight;
  $('insight-text').textContent=top?`따뜻해진 ${substance}가 위에 머물러 큰 대류 순환은 잘 생기지 않아요. 그래도 입자들은 계속 불규칙하게 움직여요. 화면의 작은 움직임은 이를 확대해서 보여 주는 모형입니다.`:content.text;
}
function makeConvectionArrows(){for(const side of [-1,1])for(let segment=0;segment<4;segment++){const a=addArrow([0,0,0],[0,1,0],segment===0?'#e9a466':segment===1?'#93bfd6':'#d5c39c');a.userData={side,segment};}}
function updateConvectionArrows(){
  const spec=FLUID_SPECS[mode],h=model.heatingHeight,base=spec.centerY-spec.height/2;
  arrows.forEach(a=>{
    const {side,segment}=a.userData,inner=model.options.heaterX+(side*.92-model.options.heaterX)*.12,outer=model.options.heaterX+(side*.92-model.options.heaterX)*.88;
    const points=[[[inner,.22],[inner,.76]],[[outer,.76],[outer,.22]],[[inner,.86],[outer,.86]],[[outer,.12],[inner,.12]]][segment];
    const toWorld=([x,y])=>new THREE.Vector3(x*spec.width/2,base+spec.height*(h+(1-h)*y),thermal?(mode==='liquid'?Math.sqrt(Math.max(0,1.55**2-(x*spec.width/2)**2))+.06:-.34):.65);
    const start=toWorld(points[0]),end=toWorld(points[1]),delta=end.sub(start),length=delta.length();a.position.copy(start);a.setDirection(delta.normalize());a.setLength(length,Math.min(.13,length*.3),Math.min(.075,length*.18));
  });
}
function moveHeater(x,height){
  model.options.heaterX=THREE.MathUtils.clamp(x,-.6,.6);model.options.heaterHeight=THREE.MathUtils.clamp(height,0,1);
  if(model.options.heaterHeight<.005)model.options.heaterHeight=0;if(model.options.heaterHeight>.995)model.options.heaterHeight=1;
  model.options.position=model.heatingHeight===0?'bottom':model.heatingHeight===1?'top':'middle';model.fieldDirty=true;
  selectOption('position',model.options.position);updateHeaterPosition();updateReadings();needsRender=true;
}
function initHeaterDrag(){
  const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),point=new THREE.Vector3();
  function onPlane(event){const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);return raycaster.ray.intersectPlane(plane,point);}
  function start(event){
    if(event.button!==0||!['liquid','gas'].includes(mode)||!onPlane(event))return;
    if(event.currentTarget!==heaterHandle&&!raycaster.intersectObject(heater,true).length)return;
    heaterDrag={id:event.pointerId,target:event.currentTarget,wasRunning:running,startX:event.clientX,startY:event.clientY,offsetX:point.x-heater.position.x,offsetY:point.y-heater.position.y,moved:false};
    running=false;orbit.enabled=false;event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();event.stopImmediatePropagation();heaterHandle.classList.add('dragging');updatePlayback();
  }
  function move(event){
    if(!heaterDrag||event.pointerId!==heaterDrag.id||!onPlane(event))return;
    if(!heaterDrag.moved&&Math.hypot(event.clientX-heaterDrag.startX,event.clientY-heaterDrag.startY)<4)return;
    if(!heaterDrag.moved){model.reset();history=[];lastHistory=-1;visualTime=0;heaterDrag.moved=true;}
    const spec=FLUID_SPECS[mode],range=heaterRange();let h=THREE.MathUtils.clamp((point.y-heaterDrag.offsetY-range.bottom)/range.height,0,1);
    if(h<.05)h=0;if(h>.95)h=1;
    moveHeater((point.x-heaterDrag.offsetX)/(spec.width/2),h);$('run-status').textContent='열원 옮기는 중';event.preventDefault();
  }
  function finish(event){
    if(!heaterDrag||event.pointerId!==heaterDrag.id)return;
    const drag=heaterDrag;heaterDrag=null;if(drag.target.hasPointerCapture(event.pointerId))drag.target.releasePointerCapture(event.pointerId);
    orbit.enabled=true;heaterHandle.classList.remove('dragging');running=event.type==='pointercancel'?false:drag.wasRunning;updatePlayback();
    if(drag.moved)toast(running?'옮긴 위치에서 새로 가열해요.':'열원을 옮겼어요. 가열을 시작해 보세요.');
  }
  heaterHandle.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerdown',start,true);
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
  heaterHandle.addEventListener('keydown',event=>{
    const deltas={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]};if(!deltas[event.key])return;
    event.preventDefault();const [dx,dy]=deltas[event.key],x=model.options.heaterX+dx,h=model.heatingHeight+dy;resetExperiment();moveHeater(x,h);
  });
}
function addProbes(points){probePositions=points.map(p=>new THREE.Vector3(...p));$('probe-labels').innerHTML=points.map((_,i)=>`<div class="probe-label" id="probe-${i}"><b>${'ABC'[i]}</b><span class="probe-temp">20 °C</span></div>`).join('');}
function clearWorld(){if(!world)return;scene.remove(world);const geometries=new Set(),materials=new Set();world.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));if(o.isInstancedMesh)o.dispose();});thermalSurfaces.forEach(({normal,infrared})=>{materials.add(normal);materials.add(infrared);});geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.uniforms?.uField?.value?.dispose();m.dispose();});}
function buildSolid(){
  const shape=model.options.shape,graph=model.solid,plate=shape==='plate';
  const supports=plate?[{x:-1.9,z:-1.2},{x:1.9,z:-1.2},{x:1.9,z:1.2}]:[solidPosition(shape,.2),solidPosition(shape,.8)];
  supports.forEach(({x,z})=>{ambient(box(.55,.12,.65,'#d7dfd2',x,.08,z));ambient(box(.16,.95,.2,'#718d7b',x,.59,z));ambient(box(.36,.14,.45,'#8ca391',x,1.08,z));});
  if(plate){
    rod=mesh(new THREE.BoxGeometry(5.7,.18,3.8),temperatureMaterial('plate',{...PLATE_SIZE,field:model.solidField}),[0,1.28,0]);
  }else{
    class SolidPath extends THREE.Curve {
      getPoint(u,target=new THREE.Vector3()){const p=solidPosition(shape,u);return target.set(p.x,p.y,p.z);}
      getPointAt(u,target){return this.getPoint(u,target);}
    }
    const path=new SolidPath(),material=temperatureMaterial('rod',{count:graph.positions.length,closed:graph.closed});
    rod=mesh(new THREE.TubeGeometry(path,96,.185,12,graph.closed),material,[0,0,0]);
    if(!graph.closed)for(const u of [0,1]){
      const geometry=new THREE.CircleGeometry(.185,20),uv=geometry.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setX(i,u);
      const p=path.getPoint(u),cap=mesh(geometry,material,[p.x,p.y,p.z]);
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),path.getTangent(u));
    }
  }
  rod.userData.shape=shape;
  const source=graph.positions[graph.source];heater=makeHeater(source.x,.04,source.z);
  hotMeshes.push(cylinder(.08,.12,.82,'#dcab6e',source.x,.69,source.z));
  if(plate)hotMeshes.push(cylinder(.13,.13,.12,'#dcab6e',source.x-.03,1.4,source.z));
  addProbes(graph.probes.map(i=>{const p=graph.positions[i];return[p.x,p.y+.63,p.z];}));
  const mid=8*PLATE_WIDTH;
  const pairs=plate?[[mid+2,mid+5],[mid+7,mid+10],[5*PLATE_WIDTH+3,2*PLATE_WIDTH+5],[11*PLATE_WIDTH+3,14*PLATE_WIDTH+5]]:
    shape==='ring'?[[1,4],[6,9],[11,14],[16,19],[39,36],[34,31],[29,26],[24,21]]:
    shape==='elbow'?[[3,6],[8,11],[14,17],[18,21]]:[[3,6],[8,11],[13,16],[17,20]];
  pairs.forEach(([a,b])=>{const point=i=>{const p=graph.positions[i];return[p.x,p.y+.34,p.z];},start=point(a),end=point(b);const arrow=addArrow(start,end,'#d39961');arrow.userData={a,b,start,end};});
  makeParticles(lightweight?66:132);
  camera.position.set(shape==='rod'?7:4,shape==='rod'?5.8:9,9);orbit.target.set(0,plate?1.5:1,0);
  updateSolidContent();
}
function buildWorld(){
  clearWorld();world=new THREE.Group();scene.add(world);rod=null;fluidField=null;flowTracers=null;arrows=[];ambientMeshes=[];hotMeshes=[];thermalSurfaces=[];surface=null;barrier=null;
  // A soft contact disk and a grid give depth without expensive shadow maps.
  const contact=mesh(new THREE.CircleGeometry(mode==='solid'?3.5:2.8,60),new THREE.MeshBasicMaterial({color:'#819c88',transparent:true,opacity:.065,depthWrite:false}),[0,.013,0]);contact.rotation.x=-Math.PI/2;contact.scale.y=.6;
  if(mode==='solid'){
    buildSolid();
  }else if(mode==='liquid'){
    ambient(cylinder(1.85,1.94,.15,'#d7ded1',0,.1,0));
    const vessel=mesh(new THREE.CylinderGeometry(1.59,1.59,2.9,48,1,true),mat('#b8d5d3',{transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}),[0,1.76,0]);vessel.userData.hideInThermal=true;
    for(let y of [.34,3.2]){let rim=mesh(new THREE.TorusGeometry(1.59,.035,8,48),mat('#8fbbb4'),[0,y,0]);rim.rotation.x=-Math.PI/2;ambient(rim);}
    fluidField=mesh(new THREE.CylinderGeometry(1.55,1.55,2.4,48),temperatureMaterial('fluid',{...FLUID_SPECS.liquid,opacity:.28,field:model.temperatureField}),[0,1.56,0]);
    for(let i=0;i<5;i++){let y=.65+i*.45;line([[1.55,y,-.15],[1.57,y,.15]],'#77a99d');}
    heater=makeHeater(0,0,0);updateHeaterPosition();
    addProbes(FLUID_PROBES.map(p=>[p.x*1.55,.36+p.h*2.4,Math.sqrt(1.55**2-(p.x*1.55)**2)+.025]));
    makeConvectionArrows();
    makeParticles(lightweight?84:180);camera.position.set(6,5.2,8.5);orbit.target.set(0,1.6,0);
  }else if(mode==='gas'){
    ambient(box(5,.16,3.6,'#d9ded1',0,.1,0));
    ambient(box(5,3.6,.06,'#dce6d9',0,1.9,-1.8,{transparent:true,opacity:.38,depthWrite:false}));
    ambient(box(.06,3.6,3.6,'#e1e8da',-2.5,1.9,0,{transparent:true,opacity:.16,depthWrite:false}));
    for(let x of [-2.5,2.5])for(let z of [-1.8,1.8])line([[x,.18,z],[x,3.7,z]],'#adbfae',.5);
    line([[-2.5,3.7,1.8],[-2.5,3.7,-1.8],[2.5,3.7,-1.8],[2.5,3.7,1.8]],'#adbfac',.5);
    ambient(box(1.5,1.3,.09,'#fffdf0',.7,2.55,-1.71));ambient(box(1.32,1.12,.1,'#b9d6d2',.7,2.55,-1.65));ambient(box(.045,1.12,.12,'#fffdf0',.7,2.55,-1.59));ambient(box(1.32,.045,.12,'#fffdf0',.7,2.55,-1.59));
    ambient(box(1.1,.12,.65,'#c6ab7e',.8,1,-.8));for(let x of [.36,1.24])for(let z of [-1.02,-.57])ambient(box(.07,.8,.07,'#8ca18b',x,.56,z));
    heater=makeHeater(0,0,0,'square');
    const body=box(.85,.58,.55,'#e2ded0',0,.35,0);ambient(body);heater.add(body);for(let i=0;i<5;i++){const strip=box(.04,.4,.02,'#dc9e69',-.3+i*.15,.35,.29);hotMeshes.push(strip);heater.add(strip);}updateHeaterPosition();
    addProbes(FLUID_PROBES.map(p=>[p.x*2.4,.25+p.h*3.3,-.375]));
    makeConvectionArrows();
    fluidField=mesh(new THREE.PlaneGeometry(4.8,3.3),temperatureMaterial('fluid',{...FLUID_SPECS.gas,opacity:.9,field:model.temperatureField}),[0,1.9,-.4]);fluidField.visible=thermal;
    makeParticles(lightweight?96:210);camera.position.set(7,5.5,8.5);orbit.target.set(0,1.7,0);
  }else{
    ambient(cylinder(.65,.8,.16,'#cbd5c6',-2.5,.1,0));ambient(cylinder(.065,.065,1.35,'#78937f',-2.5,.85,0));
    const light=mesh(new THREE.SphereGeometry(.52,24,16),mat('#edaa61',{emissive:'#cf4f1f',emissiveIntensity:.3}),[-2.5,1.85,0]);hotMeshes.push(light);heater=light;
    let frame=mesh(new THREE.TorusGeometry(.7,.04,8,48),mat('#7d9584'),[-2.5,1.85,0]);frame.rotation.y=Math.PI/2;ambient(frame);
    const targetX=-2.5+model.options.distance*1.3;
    ambient(box(.6,.14,1,'#d4dccb',targetX,.09,0));ambient(cylinder(.05,.05,1.12,'#7c957f',targetX,.7,0));
    surface=box(.13,1.3,1.15,model.options.surface==='dark'?'#394d49':'#e9eddf',targetX,1.85,0,{metalness:model.options.surface==='dark'?.02:.5});
    barrier=box(.09,1.9,2,'#91a29b',(-2.5+targetX)/2,1.85,0,{metalness:.65});barrier.visible=model.options.shield;
    addProbes([[-2.5,2.65,0],[targetX,2.85,0],[targetX+1.05,.65,1.15]]);
    for(let z of [-.32,.32])addArrow([-1.8,1.85,z],[targetX-.25,1.85,z],'#e4a465');
    makeParticles(lightweight?36:72);camera.position.set(5.5,4.5,10);orbit.target.set(-.2,1.45,0);
  }
  // Infrared surfaces use temperature colors directly, without scene lighting
  // changing their apparent temperature as the camera moves.
  const objects=new Set([...ambientMeshes,...hotMeshes,...(surface?[surface]:[]),...(barrier?[barrier]:[])]);
  objects.forEach(object=>{const normal=object.material;const infrared=new THREE.MeshBasicMaterial({color:tempColor(20),transparent:normal.transparent,opacity:normal.opacity,depthWrite:normal.depthWrite,side:normal.side,toneMapped:false});thermalSurfaces.push({object,normal,infrared});});
  orbit.update();applyTheme();resize();updateVisuals();needsRender=true;
}
const dummy=new THREE.Object3D();
function updateVisuals(){
  if(!world)return;
  if(rod){const u=rod.material.uniforms;if(model.options.shape==='plate'){const field=model.solidField;if(rod.material.userData.fieldVersion!==field.version){u.uField.value.needsUpdate=true;rod.material.userData.fieldVersion=field.version;}}else u.uSamples.value.set(model.temperatures);u.uThermal.value=Number(thermal);}
  if(fluidField){const material=fluidField.material,u=material.uniforms,field=model.temperatureField;if(material.userData.fieldVersion!==field.version){u.uField.value.needsUpdate=true;material.userData.fieldVersion=field.version;}u.uThermal.value=Number(thermal);material.transparent=!thermal;material.depthWrite=thermal;fluidField.visible=mode!=='gas'||thermal;}
  const activeHeat=model.time>0;
  hotMeshes.forEach(m=>{m.material.color.copy(thermal?tempColor(activeHeat?model.sourceTemperature:20):new THREE.Color(activeHeat?'#ec995b':'#b69b7c'));if(!thermal){m.material.emissive.set('#a54d24');m.material.emissiveIntensity=activeHeat?.35:.03;}});
  if(surface){surface.material.color.copy(thermal?tempColor(model.target):new THREE.Color(model.options.surface==='dark'?'#394d49':'#e9eddf'));if(!thermal)surface.material.emissiveIntensity=0;}
  if(barrier&&thermal)barrier.material.color.copy(tempColor(20));
  const convection=mode==='liquid'||mode==='gas';
  if(convection){updateConvectionArrows();heater.traverse(o=>{if(o.material){o.material.depthTest=!thermal;o.renderOrder=thermal?2:0;}});}
  arrows.forEach(a=>{a.visible=showArrows&&activeHeat&&(!convection||model.flow>.01);a.traverse(o=>{if(o.material)o.material.depthTest=!thermal;o.renderOrder=thermal?4:0;});});
  if(mode==='solid')arrows.forEach(arrow=>{const {a,b,start,end}=arrow.userData,difference=model.temperatures[a]-model.temperatures[b];arrow.visible=showArrows&&Math.abs(difference)>.025;const from=difference>=0?start:end,to=difference>=0?end:start;arrow.position.set(...from);arrow.setDirection(new THREE.Vector3(...to).sub(arrow.position).normalize());});
  const reverseRadiation=mode==='radiation'&&model.radiationExchange<0;
  if(mode==='radiation'){
    const path=radiationLayout(model.options.distance),end=model.options.shield?path.barrierX-.045:path.endX;
    arrows.forEach((a,i)=>{const reverse=model.options.shield?i===1:reverseRadiation,length=end-path.startX;a.position.x=reverse?end:path.startX;a.setDirection(new THREE.Vector3(reverse?-1:1,0,0));a.setLength(length,Math.min(.15,length*.28),Math.min(.085,length*.16));});
  }
  if(flowTracers){flowTracers.visible=showParticles;if(showParticles)flowTracers.update(mode,model,thermal,tempColor);}
  if(particleMesh){
  particleMesh.visible=showParticles&&(mode!=='radiation'||activeHeat);
  particleMesh.material.transparent=false;
  particleMesh.material.opacity=1;
  particleMesh.material.depthTest=!(thermal&&convection);
  particleMesh.material.depthWrite=!thermal;
  particleMesh.renderOrder=thermal?3:0;
  for(let i=0;i<particleData.length;i++){
    const p=particleData[i];let x,y,z,t;
    if(mode==='solid'){
      const n=Math.min(model.temperatures.length-1,Math.floor(i/particleData.length*model.temperatures.length)),point=model.solid.positions[n];t=model.temperatures[n];const wiggle=.006+(t-20)/80*.035;
      x=point.x+Math.sin(visualTime*12+i)*wiggle;y=point.y+(model.options.shape==='plate'?.13:.21)+Math.cos(visualTime*11+i)*wiggle;z=point.z+Math.sin(i*2.4)*.065;
    }else{
      const progress=p.phase/(Math.PI*2)+model.time*.65*(reverseRadiation?-1:1);
      x=radiationPosition(model.options.distance,model.options.shield,progress);y=1.85+Math.sin(i)*.27;z=Math.cos(i)*.28;t=reverseRadiation?model.target:model.sourceTemperature;
    }
    dummy.position.set(x,y,z);dummy.scale.setScalar(1);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,tempColor(t));
  }
  particleMesh.instanceMatrix.needsUpdate=true;if(particleMesh.instanceColor)particleMesh.instanceColor.needsUpdate=true;
  }
  const values=model.readings;
  const width=$('canvas-host').clientWidth,height=$('canvas-host').clientHeight;
  heaterHandle.hidden=!convection;
  if(convection){const anchor=heater.localToWorld(new THREE.Vector3(0,mode==='gas'?.95:.5,.1)).project(camera);heaterHandle.style.left=THREE.MathUtils.clamp((anchor.x+1)/2*width,55,width-55)+'px';heaterHandle.style.top=THREE.MathUtils.clamp((-anchor.y+1)/2*height,118,height-100)+'px';}
  probePositions.forEach((p,i)=>{const projected=p.clone().project(camera);const label=$('probe-'+i);label.style.left=((projected.x+1)/2*width)+'px';label.style.top=((-projected.y+1)/2*height)+'px';label.style.visibility=projected.z>1||projected.z< -1?'hidden':'visible';label.querySelector('.probe-temp').textContent=values[i].toFixed(1)+' °C';});
}
function applyTheme(){
  needsRender=true;
  if(!renderer)return;
  $('scene').classList.toggle('thermal',thermal);thermalButton.setAttribute('aria-pressed',String(thermal));thermalButton.innerHTML=icon('thermal')+`<span>${thermal?'일반 화면':'열화상 보기'}</span>`;
  thermalBadge.innerHTML=`<span class="thermal-dot"></span>${mode==='liquid'||mode==='gas'?'열화상 · 모형 단면':'열화상 · 모형 온도'}<b>20–100 °C</b>`;
  scene.background=new THREE.Color(thermal?'#151529':'#edf3ed');scene.fog=new THREE.Fog(thermal?'#151529':'#edf3ed',17,36);floor.material.color.set(thermal?'#1d1534':'#edf3e8');grid.visible=!thermal;
  thermalSurfaces.forEach(({object,normal,infrared})=>{object.material=thermal?infrared:normal;});
  world.traverse(object=>{if(object.userData.hideInThermal)object.visible=!thermal;});
  ambientMeshes.forEach(m=>{m.material.color.copy(thermal?tempColor(20):m.userData.normalColor);});
  document.querySelector('.temperature-key>span').textContent=thermal?'열화상 온도 (°C)':'온도 색';document.querySelector('.temperature-key>div:last-child').innerHTML=thermal?'<span>20</span><span>60</span><span>100</span>':'<span>낮음</span><span>높음</span>';
}
function resize(){if(!renderer)return;needsRender=true;const w=$('canvas-host').clientWidth,h=$('canvas-host').clientHeight;renderer.setSize(w,h,false);const base=mode==='solid'?4.25:4.15;const halfW=Math.max(base,w/h*3.2);camera.left=-halfW;camera.right=halfW;camera.top=halfW*h/w;camera.bottom=-halfW*h/w;camera.updateProjectionMatrix();}
function init3D(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#edf3ed');$('canvas-host').appendChild(renderer.domElement);
    scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ffffff','#b5c7aa',2.8));const sun=new THREE.DirectionalLight('#fff3dc',3.3);sun.position.set(3,7,5);scene.add(sun);
    camera=new THREE.OrthographicCamera(-5,5,4,-4,.1,70);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.12;orbit.minZoom=.7;orbit.maxZoom=2;orbit.minPolarAngle=.3;orbit.maxPolarAngle=Math.PI/2-.06;orbit.enablePan=false;
    floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshBasicMaterial({color:'#edf3e8'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
    grid=new THREE.GridHelper(30,60,'#d6e1d2','#dce5d8');grid.material.transparent=true;grid.material.opacity=.6;scene.add(grid);
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;updatePlayback();$('scene-error').hidden=false;});renderer.domElement.addEventListener('webglcontextrestored',()=>{$('scene-error').hidden=true;buildWorld();});
    new ResizeObserver(resize).observe($('canvas-host'));buildWorld();initHeaterDrag();animationId=requestAnimationFrame(frame);
  }catch(error){console.error(error);$('scene-error').hidden=false;$('play').disabled=true;}
}
function frame(now){
  animationId=requestAnimationFrame(frame);if(document.hidden){lastFrame=now;return;}const interval=lightweight?1000/30:1000/60;if(now-lastFrame<interval-1)return;
  const elapsed=now-lastFrame;lastFrame=now-(Math.max(0,elapsed-interval)%interval);
  const dt=Math.min((now-lastSimulationFrame)/1000,.1)||.016;lastSimulationFrame=now;
  if(running){model.step(dt*speed);visualTime+=dt*speed;}
  const moved=orbit.update();if(running||moved||needsRender){updateVisuals();renderer.render(scene,camera);needsRender=false;}
  if(running&&now-lastUi>160){updateReadings();lastUi=now;}
}
function optionsHTML(){
  if(mode==='solid')return '<h3>물체의 모양</h3><div class="shape-options">'+Object.entries(SOLID_SHAPES).map(([key,s])=>`<button data-shape="${key}" class="${key===model.options.shape?'active':''}" aria-pressed="${key===model.options.shape}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="${s.icon}"/></svg>${s.name}</button>`).join('')+'</div><h3 class="material-heading">물체의 재료</h3><div class="segmented">'+Object.entries(MATERIALS).map(([key,m])=>`<button data-material="${key}" class="${key===model.options.material?'active':''}" aria-pressed="${key===model.options.material}"><i class="material-dot ${key}"></i>${m.name}</button>`).join('')+'</div><p class="control-note">모양·재료를 바꾸면 20°C에서 다시 시작해요.</p>';
  if(mode==='liquid'||mode==='gas')return '<h3>가열하는 위치</h3><div class="segmented"><button data-position="bottom" class="active" aria-pressed="true">↓ 아래쪽</button><button data-position="top" aria-pressed="false">↑ 위쪽</button></div><p class="control-note">화면의 <b>✥ 열원 이동</b>을 좌우·상하로 끌어 보세요. 옮기면 20°C에서 다시 시작해요.</p><p class="control-note particle-note">입자의 작은 움직임은 확대해서 보여 줘요. 위를 데워도 입자는 움직여요. 큰 순환과 꼬리는 대류가 생길 때 나타나요.</p>';
  return `<div class="field-heading"><label for="distance">열원과의 거리</label><output id="distance-value">${model.options.distance}칸</output></div><input id="distance" type="range" min="1" max="4" step=".5" value="${model.options.distance}"><div class="range-labels"><span>가까이</span><span>멀리</span></div><h3 style="margin-top:17px">받는 물체의 표면</h3><div class="segmented"><button data-surface="dark" class="active" aria-pressed="true">검고 무광</button><button data-surface="shiny" aria-pressed="false">반짝이는 금속</button></div><label class="toggle-row"><span>반사 가림판 넣기</span><input id="shield" type="checkbox"><span class="switch"></span></label><p class="control-note">이상적인 반사판이에요. 직접 복사를 막으면 받는 물체는 서서히 식어요.</p>`;
}
function setMode(next){
  mode=next;model=new HeatModel(mode,{power:Number($('power').value)});running=false;history=[];lastHistory=-1;visualTime=0;
  const c=CONTENT[mode];for(const [id,key] of [['scene-chip','chip'],['scene-title','title'],['scene-description','desc'],['insight-title','insight'],['insight-text','text'],['everyday-text','everyday'],['question','question']])$(id).textContent=c[key];
  $('answers').innerHTML=c.answers.map((a,i)=>`<button data-answer="${i}" aria-pressed="false">${a}</button>`).join('');$('answer-feedback').textContent='먼저 예상해 보고, 실험으로 확인해 보세요.';$('answer-feedback').className='answer-feedback';
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  $('mode-controls').innerHTML=optionsHTML();showParticles=mode!=='solid';$('show-particles').checked=showParticles;$('particle-label').textContent=mode==='solid'?'고체 입자 보기':mode==='radiation'?'복사 에너지 표시':'입자 움직임 보기';
  const directionLabel=$('show-arrows').closest('label').querySelector('span');directionLabel.innerHTML=icon('arrow')+(mode==='liquid'||mode==='gas'?'물·공기의 흐름 방향':'순 열 이동 방향');
  $('readings').innerHTML=c.probes.map((p,i)=>`<div class="reading-row"><i style="background:${['#dd8356','#349f90','#6385ba'][i]}"></i><span>${p}</span><strong id="reading-${i}">20<small>°C</small></strong></div>`).join('');
  if(scene)buildWorld();updateReadings();updatePlayback();
}
function updateReadings(){
  const values=model.readings;values.forEach((v,i)=>{$('reading-'+i).innerHTML=v.toFixed(1)+'<small>°C</small>';});
  const seconds=Math.floor(model.time);$('elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  if(seconds!==lastHistory){history.push({time:seconds,values:values.slice()});if(history.length>100)history.shift();lastHistory=seconds;}
  ['a','b','c'].forEach((key,i)=>{$('chart-'+key).setAttribute('d',history.map((p,j)=>`${j?'L':'M'}${(j/(Math.max(history.length-1,30))*260).toFixed(1)},${(45-(p.values[i]-20)/80*42).toFixed(1)}`).join(' '));});
}
function updatePlayback(){ needsRender=true;updateReadings();$('play-label').textContent=running?'일시정지':model.time>0?'계속 가열':'가열 시작';$('play').firstElementChild.innerHTML=icon(running?'pause':'play');$('run-status').textContent=running?(mode==='radiation'&&model.options.shield?'가림판으로 차단 중':'가열 중'):model.time>0?'멈춰 있어요':'준비됐어요';$('status-dot').classList.toggle('running',running); }
function resetExperiment(){model.reset();running=false;history=[];lastHistory=-1;visualTime=0;updateReadings();updatePlayback();if(scene)updateVisuals();}
function changedCondition(){model.reset();running=false;history=[];lastHistory=-1;visualTime=0;if(scene)buildWorld();updateReadings();updatePlayback();toast('조건을 바꿨어요. 가열을 시작해 비교해 보세요.');}
function updateSolidContent(){
  const shape=SOLID_SHAPES[model.options.shape];$('scene-title').textContent=shape.title;$('scene-description').textContent=shape.hint;
  $('insight-text').textContent=shape.hint+' 고체 입자는 제자리에서 진동해요. 재료의 차이는 같은 모양끼리 비교해 보세요.';
  document.querySelectorAll('#readings .reading-row>span').forEach((label,i)=>label.textContent=shape.probes[i]);
}
function selectOption(group,value){document.querySelectorAll(`[data-${group}]`).forEach(b=>{b.classList.toggle('active',b.dataset[group]===value);b.setAttribute('aria-pressed',String(b.dataset[group]===value));});}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('play').addEventListener('click',()=>{running=!running;updatePlayback();});$('reset').addEventListener('click',resetExperiment);
$('power').addEventListener('input',e=>{model.options.power=Number(e.target.value);$('power-value').textContent=e.target.value+'단계';updateReadings();needsRender=true;});
$('mode-controls').addEventListener('click',e=>{let b=e.target.closest('button');if(!b)return;for(let key of ['shape','material','position','surface']){if(b.dataset[key]){model.options[key]=b.dataset[key];if(key==='position')model.options.heaterHeight=b.dataset[key]==='top'?1:0;selectOption(key,b.dataset[key]);changedCondition();}}});
$('mode-controls').addEventListener('input',e=>{if(e.target.id==='distance'){model.options.distance=Number(e.target.value);$('distance-value').textContent=e.target.value+'칸';changedCondition();}if(e.target.id==='shield'){model.options.shield=e.target.checked;if(barrier)barrier.visible=e.target.checked;updatePlayback();}});
$('show-arrows').addEventListener('change',e=>{showArrows=e.target.checked;needsRender=true;});$('show-particles').addEventListener('change',e=>{showParticles=e.target.checked;needsRender=true;});
$('lightweight').addEventListener('change',e=>{lightweight=e.target.checked;renderer?.setPixelRatio(lightweight?1:Math.min(devicePixelRatio,1.5));$('performance-note').textContent=lightweight?'입자 수와 해상도를 줄여 가볍게 실행해요.':'입자를 더 자세하게 보여 줘요.';if(scene)buildWorld();});
thermalButton.addEventListener('click',()=>{thermal=!thermal;applyTheme();toast(thermal?'색으로 온도를 살펴보세요. 물·공기는 모형 단면입니다.':'일반 3D 화면으로 돌아왔어요.');});
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});}));
$('view-reset').addEventListener('click',()=>{if(!orbit)return;camera.zoom=1;buildWorld();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('experiment-panel').requestFullscreen();}catch{toast('이 브라우저에서는 전체 화면을 사용할 수 없어요.');}});
$('answers').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const correct=Number(b.dataset.answer)===CONTENT[mode].correct;document.querySelectorAll('[data-answer]').forEach(x=>{x.classList.remove('selected','wrong');x.setAttribute('aria-pressed',String(x===b));});b.classList.add(correct?'selected':'wrong');$('answer-feedback').textContent=(correct?'맞아요! ':'다시 살펴볼까요? ')+CONTENT[mode].feedback;$('answer-feedback').className='answer-feedback'+(correct?' correct':'');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(running){running=false;updateReadings();updatePlayback();toast('다른 탭으로 이동해 실험을 잠시 멈췄어요.');}cancelAnimationFrame(animationId);}else if(renderer){lastFrame=performance.now();lastSimulationFrame=lastFrame;needsRender=true;animationId=requestAnimationFrame(frame);}});

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3100);}
function showDialog(id){running=false;updatePlayback();$(id).showModal();}
$('guide-open').addEventListener('click',()=>showDialog('guide-dialog'));$('model-info').addEventListener('click',()=>showDialog('guide-dialog'));
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
try{const saved=JSON.parse(localStorage.getItem('ongi-notes-v1')||'[]');if(Array.isArray(saved))notes=saved.filter(n=>typeof n.title==='string'&&typeof n.conditions==='string'&&typeof n.text==='string'&&Array.isArray(n.values)).slice(-100);}catch{}
function saveNotes(){try{localStorage.setItem('ongi-notes-v1',JSON.stringify(notes));}catch{toast('브라우저 저장 공간이 부족해요. 노트를 내려받아 보관하세요.');}$('note-count').textContent=notes.length;}
function conditionText(){let extra=mode==='solid'?`${SOLID_SHAPES[model.options.shape].name} · ${MATERIALS[model.options.material].name}`:mode==='radiation'?`${model.options.distance}칸 · ${model.options.surface==='dark'?'검고 무광':'반짝이는 금속'} · 가림판 ${model.options.shield?'있음':'없음'}`:`열원: 왼쪽에서 ${Math.round((model.options.heaterX+1)*50)}% · 높이 ${Math.round(model.heatingHeight*100)}%`;return `${extra} · 가열 ${model.options.power}단계 · ${Math.floor(model.time)}초 · ${thermal?'열화상':'일반 화면'}`;}
function renderNotes(){
  $('notebook-total').textContent=notes.length+'개';$('note-list').replaceChildren();$('export-notes').disabled=!notes.length;
  if(!notes.length){const empty=document.createElement('p');empty.className='empty-notes';empty.textContent='아직 기록이 없어요. 실험 화면의 “지금 관찰한 것 기록하기”를 눌러 첫 발견을 남겨 보세요.';$('note-list').append(empty);return;}
  [...notes].reverse().forEach((n,index)=>{const entry=document.createElement('article');entry.className='note-entry';const h=document.createElement('h3');h.textContent=`${notes.length-index}. ${n.title}`;const condition=document.createElement('small');condition.textContent=n.conditions;const readings=document.createElement('small');readings.textContent=n.values.map((v,i)=>`${'ABC'[i]}: ${Number(v).toFixed(1)} °C`).join(' / ');const field=document.createElement('textarea');field.value=n.text;field.placeholder='무엇이 달라졌나요? 그 까닭은 무엇일까요?';field.setAttribute('aria-label',`${n.title} 관찰 내용`);field.maxLength=3000;field.addEventListener('input',()=>{n.text=field.value;saveNotes();});entry.append(h,condition,readings,field);$('note-list').append(entry);});
  $('note-list').querySelectorAll('.note-entry').forEach((entry,i)=>{const note=notes[notes.length-1-i];const remove=document.createElement('button');remove.className='text-button note-delete';remove.textContent='이 기록 삭제';remove.addEventListener('click',()=>{notes.splice(notes.indexOf(note),1);saveNotes();renderNotes();});entry.append(remove);});
}
$('record').addEventListener('click',()=>{if(notes.length>=100){toast('노트가 100개 찼어요. 먼저 파일로 내려받아 주세요.');return;}notes.push({title:CONTENT[mode].short,conditions:conditionText(),values:model.readings.slice(),text:'',date:new Date().toLocaleString('ko-KR')});saveNotes();renderNotes();showDialog('notebook-dialog');$('note-list textarea')?.focus();});
$('notebook-open').addEventListener('click',()=>{renderNotes();showDialog('notebook-dialog');});
$('export-notes').addEventListener('click',()=>{const text='온기 실험실 · 나의 탐구 노트\n온도와 시간은 원리를 설명하는 모형 값입니다.\n\n'+notes.map((n,i)=>`${i+1}. ${n.title}\n${n.date||''}\n${n.conditions}\n${n.values.map((v,j)=>`${'ABC'[j]}: ${Number(v).toFixed(1)} °C`).join(' / ')}\n관찰: ${n.text||'(아직 작성하지 않았어요)'}\n`).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='온기실험실-탐구노트.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
saveNotes();setMode('solid');init3D();
