import * as THREE from 'three';
import { FIELD_WIDTH, FIELD_HEIGHT } from './temperature-field.js';

// One continuous temperature field per object. The numerical model stays coarse;
// interpolation happens per pixel, not once per separate colored mesh.
export function temperatureMaterial(kind, { height = 2.4, width = 3.1, opacity = 1, field = null, count = 22, closed = false } = {}) {
  const fieldWidth = field?.width ?? FIELD_WIDTH, fieldHeight = field?.height ?? FIELD_HEIGHT;
  const texture = field ? new THREE.DataTexture(field.data, fieldWidth, fieldHeight, THREE.RGBAFormat) : null;
  if (texture) { texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true; }
  return new THREE.ShaderMaterial({
    uniforms: {
      uKind: { value: kind === 'rod' ? 0 : kind === 'plate' ? 2 : 1 },
      uThermal: { value: 0 },
      uSamples: { value: new Float32Array(64).fill(20) }, uSampleCount: { value: count }, uClosed: { value: Number(closed) },
      uField: { value: texture }, uFieldSize: { value: new THREE.Vector2(fieldWidth, fieldHeight) },
      uWidth: { value: width }, uHeight: { value: height },
      uOpacity: { value: opacity },
    },
    transparent: opacity < 1,
    depthWrite: opacity === 1,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec2 vHeatUV;
      void main() {
        vLocal = position;
        vHeatUV = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform int uKind;
      uniform float uThermal, uSamples[64], uWidth, uHeight, uOpacity, uClosed;
      uniform int uSampleCount;
      uniform sampler2D uField;
      uniform vec2 uFieldSize;
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec2 vHeatUV;

      // Monotone cubic interpolation: smooth slopes without inventing hot/cold
      // spots or overshooting the neighboring numerical temperatures.
      float slope(float a, float b) {
        return a * b > 0.0 ? 2.0 * a * b / (a + b) : 0.0;
      }
      float sampleAt(int i) {
        int index = clamp(i, 0, max(0, uSampleCount - 1));
        if (uClosed > 0.5) index = int(mod(float(i + uSampleCount), float(max(1, uSampleCount))));
        return uSamples[clamp(index, 0, 63)];
      }
      float rodTemperature() {
        float p = uClosed > 0.5 ? fract(vHeatUV.x) * float(uSampleCount) : clamp(vHeatUV.x, 0.0, 1.0) * float(uSampleCount - 1);
        int i = int(floor(p));
        float t = fract(p);
        float a = sampleAt(i - 1);
        float b = sampleAt(i);
        float c = sampleAt(i + 1);
        float d = sampleAt(i + 2);
        float m0 = slope(b - a, c - b), m1 = slope(c - b, d - c);
        float t2 = t*t, t3 = t2*t;
        return (2.0*t3-3.0*t2+1.0)*b + (t3-2.0*t2+t)*m0
             + (-2.0*t3+3.0*t2)*c + (t3-t2)*m1;
      }
      float fluidTemperature() {
        vec2 p = clamp(vec2(vLocal.x/uWidth, (uKind == 2 ? vLocal.z : vLocal.y)/uHeight)+0.5, 0.0, 1.0);
        vec2 uv = (p*(uFieldSize-1.0)+0.5)/uFieldSize;
        vec2 encoded = texture2D(uField, uv).rg;
        return 20.0 + 80.0 * dot(encoded, vec2(256.0, 1.0))/257.0;
      }
      vec3 palette(float t) {
        // sRGB iron palette; matches the fixed 20–100 °C legend exactly.
        vec3 a=vec3(37.0,18.0,89.0)/255.0, b=vec3(83.0,47.0,152.0)/255.0;
        vec3 c=vec3(163.0,49.0,137.0)/255.0, d=vec3(228.0,80.0,87.0)/255.0;
        vec3 e=vec3(250.0,139.0,59.0)/255.0, f=vec3(255.0,215.0,102.0)/255.0;
        vec3 g=vec3(255.0,243.0,189.0)/255.0;
        float p = clamp((t-20.0)/80.0, 0.0, 1.0)*6.0;
        if(p<1.0)return mix(a,b,p);
        if(p<2.0)return mix(b,c,p-1.0);
        if(p<3.0)return mix(c,d,p-2.0);
        if(p<4.0)return mix(d,e,p-3.0);
        if(p<5.0)return mix(e,f,p-4.0);
        return mix(f,g,p-5.0);
      }
      vec3 ordinaryColor(float t) {
        float p=clamp((t-20.0)/80.0,0.0,1.0);
        vec3 a=vec3(116.0,175.0,208.0)/255.0, b=vec3(114.0,189.0,166.0)/255.0;
        vec3 c=vec3(232.0,207.0,121.0)/255.0, d=vec3(227.0,119.0,78.0)/255.0;
        if(p<0.25)return mix(a,b,p*4.0);
        if(p<0.65)return mix(b,c,(p-0.25)/0.4);
        return mix(c,d,(p-0.65)/0.35);
      }
      void main() {
        float temperature = uKind == 0 ? rodTemperature() : fluidTemperature();
        vec3 color;
        if(uThermal>0.5){
          color=palette(temperature);
          // Static, subpixel dithering avoids 8-bit banding without animation,
          // blur passes, glow, or a simulated change in the measured temperature.
          float dither=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5;
          color+=dither/255.0;
        }else{
          float light=0.79+0.21*max(dot(normalize(vNormal),normalize(vec3(-0.3,0.65,1.0))),0.0);
          color=ordinaryColor(temperature)*light;
        }
        gl_FragColor=vec4(color,uThermal>0.5?1.0:uOpacity);
      }
    `,
  });
}
