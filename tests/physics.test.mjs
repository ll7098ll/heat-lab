import test from 'node:test';
import assert from 'node:assert/strict';
import { HeatModel } from '../dist/physics.js';
import { SOLID_SHAPES, PLATE_WIDTH, PLATE_HEIGHT, createConductionGraph } from '../dist/conduction.js';
import { FLUID_SPECS, FLUID_PROBES, FIELD_WIDTH, FIELD_HEIGHT, convectionPosition, fluidParticlePosition, radiationLayout, radiationPosition } from '../dist/temperature-field.js';
function run(mode,options={},seconds=60){const m=new HeatModel(mode,options);for(let i=0;i<seconds*10;i++)m.step(.1);return m;}

test('bending a rod preserves conduction along its length, without shortcuts across space',()=>{
  const straight=run('solid',{shape:'rod'}),bent=run('solid',{shape:'elbow'});
  assert.deepEqual(bent.temperatures,straight.temperatures);
  const g=bent.solid;
  assert.notEqual(g.positions[0].z,g.positions.at(-1).z);
  for(let i=0;i<g.neighbors.length;i++)assert.ok(g.neighbors[i].every(j=>Math.abs(j-i)===1));
});

test('a ring conducts in both directions symmetrically, with no heat crossing its hole',()=>{
  const m=run('solid',{shape:'ring'},30),n=m.temperatures.length;
  assert.deepEqual(m.solid.neighbors[0],[1,n-1]);
  for(let i=1;i<n/2;i++)assert.ok(Math.abs(m.temperatures[i]-m.temperatures[n-i])<1e-10);
  assert.ok(m.readings[0]>m.readings[2]);assert.equal(m.readings[0],m.readings[1]);
  assert.ok(m.solid.neighbors.every(neighbors=>neighbors.length===2));
});

test('a plate spreads heat in two dimensions and conserves internal exchanges',()=>{
  const m=run('solid',{shape:'plate'},30),at=(x,z)=>m.temperatures[z*PLATE_WIDTH+x];
  assert.ok(at(3,8)>at(3,12)&&at(3,12)>20.1);assert.ok(at(3,8)>at(12,8));
  for(let z=0;z<PLATE_HEIGHT;z++)for(let x=0;x<PLATE_WIDTH;x++)assert.ok(Math.abs(at(x,z)-at(x,PLATE_HEIGHT-1-z))<1e-10);
  // With the source matched to its cell, only ambient cooling changes total heat.
  m.temperatures[m.solid.source]=m.sourceTemperature;
  const before=m.temperatures.reduce((a,b)=>a+b,0),excess=before-20*m.temperatures.length;
  m.step(.025);
  assert.ok(Math.abs(m.temperatures.reduce((a,b)=>a+b,0)-(before-.025*.004*excess))<1e-8);
});

test('every solid shape remains bounded at maximum power and resets across geometry changes',()=>{
  for(const shape of Object.keys(SOLID_SHAPES))for(const material of ['copper','iron','wood']){
    const m=run('solid',{shape,material,power:5},120);
    assert.ok(m.temperatures.every(t=>Number.isFinite(t)&&t>=20&&t<=90));
    m.options.shape=shape==='plate'?'ring':'plate';m.reset();
    assert.equal(m.temperatures.length,createConductionGraph(m.options.shape).positions.length);
    assert.deepEqual(m.readings,[20,20,20]);assert.equal(m.options.material,material);
  }
});

test('plate thermal texels and probe nodes represent the same temperature without transposition',()=>{
  const m=run('solid',{shape:'plate'},45),field=m.solidField;
  assert.equal(field.width,PLATE_WIDTH);assert.equal(field.height,PLATE_HEIGHT);
  for(let i=0;i<m.temperatures.length;i++){
    const decoded=20+80*(field.data[i*4]*256+field.data[i*4+1])/65535;
    assert.ok(Math.abs(decoded-m.temperatures[i])<80/65535);
    const p=m.solid.positions[i];
    assert.ok(Math.abs((p.x/5.7+.5)*(PLATE_WIDTH-1)-i%PLATE_WIDTH)<1e-10);
    assert.ok(Math.abs((p.z/3.8+.5)*(PLATE_HEIGHT-1)-Math.floor(i/PLATE_WIDTH))<1e-10);
  }
});
test('conduction advances from the heated end and stays within the heat source temperature',()=>{const m=run('solid');for(let i=1;i<m.temperatures.length;i++)assert.ok(m.temperatures[i-1]>=m.temperatures[i]);assert.ok(m.temperatures.every(t=>t>=20&&t<=70));assert.ok(m.readings[2]>20.5);});
test('conduction is faster in copper than iron, and faster in iron than wood',()=>{const temps=['copper','iron','wood'].map(material=>run('solid',{material}).readings[1]);assert.ok(temps[0]>temps[1]&&temps[1]>temps[2]);});
test('heating from below circulates; heating from above remains stably stratified',()=>{for(const mode of ['liquid','gas']){const bottom=run(mode,{position:'bottom'}),top=run(mode,{position:'top'});assert.ok(bottom.flow>.1);assert.equal(top.flow,0);assert.ok(bottom.lower>bottom.upper);assert.ok(top.upper>top.lower);assert.ok(bottom.lower-bottom.upper<top.upper-top.lower);}});
test('radiation responds to distance, absorption, and blocking',()=>{const near=run('radiation',{distance:1}),far=run('radiation',{distance:4}),shiny=run('radiation',{distance:1,surface:'shiny'}),blocked=run('radiation',{shield:true});assert.ok(near.target>far.target);assert.ok(near.target>shiny.target);assert.equal(blocked.target,20);});
test('reset clears accumulated heat and time while retaining experiment conditions',()=>{const m=run('solid',{material:'iron',power:5});m.reset();assert.equal(m.time,0);assert.deepEqual(m.readings,[20,20,20]);assert.equal(m.options.material,'iron');assert.equal(m.options.power,5);});
test('every heater setting stays below its source temperature, including stable top heating',()=>{
  for(const mode of ['solid','liquid','gas','radiation'])for(const power of [1,2,3,4,5])for(const position of ['bottom','top']){
    const m=run(mode,{power,distance:1,position},600);
    const values=mode==='solid'?m.temperatures:mode==='radiation'?[m.target]:[m.lower,m.upper,...m.readings];
    assert.ok(values.every(v=>Number.isFinite(v)&&v>=20&&v<=m.sourceTemperature+.002),`${mode}, power ${power}, ${position}: ${values}`);
  }
});
test('a screen cools an already warm receiver; removing it resumes heating',()=>{
  const m=run('radiation',{distance:1},60),warm=m.target;
  m.options.shield=true;assert.equal(m.radiationExchange,0);m.step(15);assert.ok(m.target<warm&&m.target>20);
  const cooled=m.target;m.options.shield=false;m.step(15);assert.ok(m.target>cooled);
});
test('net radiation changes direction when the receiver is hotter, and vanishes at equal temperatures',()=>{
  const m=new HeatModel('radiation');m.target=m.sourceTemperature;assert.equal(m.radiationExchange,0);
  m.target=80;assert.ok(m.radiationExchange<0);m.step(1);assert.ok(m.target<80);
  const warmed=run('radiation',{power:5,distance:1},120);warmed.options.power=1;
  const before=warmed.target;assert.ok(warmed.radiationExchange<0);warmed.step(1);assert.ok(warmed.target<before);
});
test('radiation exchange has the small-source distance dependence and gray-surface absorption',()=>{
  const near=new HeatModel('radiation',{distance:1}),far=new HeatModel('radiation',{distance:2}),shiny=new HeatModel('radiation',{distance:1,surface:'shiny'});
  assert.ok(Math.abs(near.radiationExchange/far.radiationExchange-4)<1e-10);
  assert.ok(Math.abs(near.radiationExchange/shiny.radiationExchange-.9/.22)<1e-10);
});
test('convection tracers rise on the warmer left and descend on the cooler right, inside the fluid',()=>{
  for(const mode of ['liquid','gas']){
    const m=run(mode,{},15),spec=FLUID_SPECS[mode],p={phase:0,ring:.75,offset:.5,z:0};
    const left=convectionPosition(mode,p,0),leftNext=convectionPosition(mode,p,.01);
    const right=convectionPosition(mode,{...p,phase:Math.PI},0),rightNext=convectionPosition(mode,{...p,phase:Math.PI},.01);
    assert.ok(leftNext.y>left.y&&rightNext.y<right.y);
    assert.ok(m.fluidTemperature(left.x/(spec.width*.5),.5)>m.fluidTemperature(right.x/(spec.width*.5),.5));
    for(let phase=0;phase<7;phase+=.1){const pos=convectionPosition(mode,p,phase);assert.ok(Math.abs(pos.x)<spec.width/2&&Math.abs(pos.y-spec.centerY)<spec.height/2);}
  }
});
test('fluid probes sample the same linearly filtered scalar data uploaded to the thermal shader',()=>{
  const m=run('liquid',{},17),field=m.temperatureField;
  // Independently emulate WebGL RGBA8 bilinear filtering and shader decoding.
  function gpuSample(x,h){
    const px=(x+1)/2*(FIELD_WIDTH-1),py=h*(FIELD_HEIGHT-1),x0=Math.floor(px),y0=Math.floor(py);
    let rg=[0,0];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const i=(Math.min(y0+dy,FIELD_HEIGHT-1)*FIELD_WIDTH+Math.min(x0+dx,FIELD_WIDTH-1))*4;
      const weight=(dx?px-x0:1-px+x0)*(dy?py-y0:1-py+y0);
      for(let c=0;c<2;c++)rg[c]+=field.data[i+c]/255*weight;
    }
    return 20+80*(rg[0]*256+rg[1])/257;
  }
  FLUID_PROBES.forEach((p,i)=>assert.ok(Math.abs(m.readings[i]-gpuSample(p.x,p.h))<1e-9));
  for(let x=-1;x<=1;x+=.07)for(let h=0;h<=1;h+=.07){const t=gpuSample(x,h);assert.ok(t>=Math.min(m.lower,m.upper)-.002&&t<=Math.max(m.lower,m.upper)+.002);}
  const top=run('liquid',{position:'top'},17);assert.equal(top.flow,0);
  assert.ok(top.fluidTemperature(-.55,.8)>top.fluidTemperature(.6,.8));
  m.reset();assert.deepEqual(m.readings,[20,20,20]);
});
test('radiation markers reflect before the screen at every distance without piling up at the source',()=>{
  for(const distance of [1,1.5,2,3,4]){
    const layout=radiationLayout(distance),positions=[];
    for(let i=0;i<100;i++){const x=radiationPosition(distance,true,i/100);positions.push(x);assert.ok(x>=layout.startX-1e-12&&x<=layout.barrierX-.045+1e-12);}
    assert.ok(new Set(positions.map(x=>x.toFixed(5))).size>40);
    assert.ok(radiationPosition(distance,false,.99)>layout.barrierX);
  }
});
test('simulation speed changes time, not the physical result',()=>{
  for(const mode of ['liquid','gas','radiation']){const fine=run(mode,{},20),fast=new HeatModel(mode);for(let i=0;i<50;i++)fast.step(.4);fine.readings.forEach((v,i)=>assert.ok(Math.abs(v-fast.readings[i])<.02));}
});
test('moving the heater moves the warm rising region, with descending return flow on both sides',()=>{
  for(const mode of ['liquid','gas'])for(const heaterX of [-.6,0,.6]){
    const m=run(mode,{heaterX},15),spec=FLUID_SPECS[mode];
    assert.ok(m.fluidTemperature(heaterX,.5)>m.fluidTemperature(heaterX<0?.85:-.85,.5));
    for(const offset of [.01,.99]){
      const particle={phase:0,ring:.94,z:0,offset},up=convectionPosition(mode,particle,0,heaterX),upNext=convectionPosition(mode,particle,.01,heaterX);
      const down=convectionPosition(mode,{...particle,phase:Math.PI},0,heaterX),downNext=convectionPosition(mode,{...particle,phase:Math.PI},.01,heaterX);
      assert.ok(upNext.y>up.y&&downNext.y<down.y);
      assert.ok(Math.abs(up.x/(spec.width/2)-heaterX)<.05);
    }
  }
});
test('an elevated heater produces bulk circulation above its height, without a lower circulation loop',()=>{
  for(const mode of ['liquid','gas'])for(const heaterHeight of [.3,.6,.9,1]){
    const m=run(mode,{heaterX:.4,heaterHeight},100),spec=FLUID_SPECS[mode];
    assert.ok(m.readings.every(t=>t>=20&&t<=m.sourceTemperature+.002));
    if(heaterHeight===1){assert.equal(m.flow,0);continue;}
    const mobile={phase:0,ring:.9,z:.4,offset:.99},still={...mobile,offset:.01};
    for(let phase=0;phase<7;phase+=.2){const p=convectionPosition(mode,mobile,phase,.4,heaterHeight);assert.ok(p.y>spec.centerY-spec.height/2+spec.height*heaterHeight&&p.y<spec.centerY+spec.height/2);}
    assert.deepEqual(convectionPosition(mode,still,0,.4,heaterHeight),convectionPosition(mode,still,3,.4,heaterHeight));
    assert.ok(m.fluidTemperature(.4,heaterHeight)>m.fluidTemperature(.4,heaterHeight*.25));
  }
});

test('microscopic motion continues without convection, remains bounded, and freezes at the same simulation time',()=>{
  for(const mode of ['liquid','gas'])for(const heaterHeight of [.6,1]){
    const m=run(mode,{heaterHeight},30),spec=FLUID_SPECS[mode],particle={phase:0,ring:.9,offset:.01,z:.3};
    if(heaterHeight===1)assert.equal(m.flow,0);
    const at=time=>fluidParticlePosition(mode,particle,0,time,40,-.55,heaterHeight);
    assert.notDeepEqual(at(0),at(.3));assert.deepEqual(at(4),at(4));
    const center=convectionPosition(mode,particle,0,-.55,heaterHeight);
    for(let time=0;time<30;time+=.13){const p=at(time);
      assert.ok(Math.abs(p.x-center.x)<=.076&&Math.abs(p.y-center.y)<=.076);
      assert.ok(Math.abs(p.x)<spec.width/2&&Math.abs(p.y-spec.centerY)<spec.height/2);
      if(mode==='liquid')assert.ok(p.x**2+p.z**2<(spec.width/2)**2);
    }
  }
});
