import * as THREE from 'three';
import { FLUID_SPECS, convectionPosition, fluidParticlePosition } from './temperature-field.js';

// Restore the original filled sphere particles, retaining short flow trails.
// Instances batch the spheres into one draw call; trails use a second call.
export class FlowTracers extends THREE.Group {
  constructor(particles) {
    super(); this.particles = particles; this.segments = 6;
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.052,8,6),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),particles.length);
    this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleTransform = new THREE.Object3D();
    const trailGeometry = new THREE.BufferGeometry(), vertices = particles.length * this.segments * 2;
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const fade = new Float32Array(vertices);
    for (let i=0;i<particles.length;i++) for(let j=0;j<this.segments;j++) for(let end=0;end<2;end++) fade[(i*this.segments+j)*2+end]=.75*(1-(j+end)/this.segments);
    trailGeometry.setAttribute('fade', new THREE.BufferAttribute(fade,1));
    this.trails = new THREE.LineSegments(trailGeometry,new THREE.ShaderMaterial({
      uniforms:{uColor:{value:new THREE.Color('#ffffff')}},transparent:true,depthWrite:false,toneMapped:false,
      vertexShader:`attribute float fade;varying float vFade;void main(){vFade=fade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform vec3 uColor;varying float vFade;void main(){gl_FragColor=vec4(uColor,vFade);
        #include <colorspace_fragment>
      }`,
    }));
    this.heads.frustumCulled=this.trails.frustumCulled=false;
    this.trails.renderOrder=5;this.heads.renderOrder=6;
    this.add(this.trails,this.heads);
  }
  update(mode,model,thermal,colorForTemperature) {
    const spec=FLUID_SPECS[mode],transform=this.particleTransform;
    const tailPositions=this.trails.geometry.attributes.position;
    this.heads.material.depthTest=this.trails.material.depthTest=!thermal;
    this.heads.material.depthWrite=!thermal;
    this.trails.material.uniforms.uColor.value.set(thermal?'#fff3df':'#315e55');
    this.trails.visible=model.flow>.01&&model.phase>0;
    const trailPhase=Math.min(model.phase,model.flow*.85);
    const positionAt=(particle,phase,time)=>{
      const base=convectionPosition(mode,particle,phase,model.options.heaterX,model.heatingHeight);
      const temperature=model.fluidTemperature(base.x/(spec.width*.5),(base.y-spec.centerY)/spec.height+.5);
      const p=fluidParticlePosition(mode,particle,phase,time,temperature,model.options.heaterX,model.heatingHeight);
      if(thermal)p.z=mode==='liquid'?Math.sqrt(Math.max(0,1.55**2-p.x*p.x))+.02:-.375;
      return p;
    };
    this.particles.forEach((particle,i)=>{
      const p=positionAt(particle,model.phase,model.time);
      transform.position.set(p.x,p.y,p.z);transform.scale.setScalar(thermal?.65:1);transform.updateMatrix();this.heads.setMatrixAt(i,transform.matrix);
      const color=colorForTemperature(model.fluidTemperature(p.x/(spec.width*.5),(p.y-spec.centerY)/spec.height+.5));
      this.heads.setColorAt(i,color);
      if(this.trails.visible)for(let j=0;j<this.segments;j++)for(let end=0;end<2;end++){
        const age=(j+end)/this.segments;
        const past=positionAt(particle,model.phase-trailPhase*age,Math.max(0,model.time-Math.min(model.time,.85)*age));
        tailPositions.setXYZ((i*this.segments+j)*2+end,past.x,past.y,past.z);
      }
    });
    this.heads.instanceMatrix.needsUpdate=true;if(this.heads.instanceColor)this.heads.instanceColor.needsUpdate=true;tailPositions.needsUpdate=true;
  }
}
