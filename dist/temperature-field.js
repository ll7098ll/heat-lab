// Shared by the thermal texture, tracers and thermometers. Encode a scalar
// temperature (not a color) in RG so WebGL linear filtering stays accurate.
export const FIELD_WIDTH = 32, FIELD_HEIGHT = 48;
export const FLUID_SPECS = {
  liquid: { width: 3.1, height: 2.4, centerY: 1.56 },
  gas: { width: 4.8, height: 3.3, centerY: 1.9 },
};
export const FLUID_PROBES = [{ x: .35, h: .15 }, { x: .35, h: .5 }, { x: .35, h: .85 }];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;

export class TemperatureField {
  constructor() { this.data = new Uint8Array(FIELD_WIDTH * FIELD_HEIGHT * 4); this.version = 0; }
  update(lower, upper, phase, flow, heaterX = -.55, heaterHeight = 0) {
    for (let row = 0; row < FIELD_HEIGHT; row++) {
      const h = row / (FIELD_HEIGHT - 1), topHeating = heaterHeight >= .97;
      const relativeHeight = topHeating ? h : clamp((h-heaterHeight)/(1-heaterHeight),0,1);
      const base = mix(lower, upper, relativeHeight);
      const bend = .07 * Math.sin(h * 5 - phase * .55) * Math.min(flow, 1);
      for (let col = 0; col < FIELD_WIDTH; col++) {
        const x = col / (FIELD_WIDTH - 1) * 2 - 1;
        const rise = Math.exp(-(((x - heaterX - bend) / .28) ** 2));
        const fall = Math.exp(-(((x - .85) / .24) ** 2)) + Math.exp(-(((x + .85) / .24) ** 2));
        const circulation = (rise * .7 - fall * .3) * Math.sin(relativeHeight * Math.PI);
        let t = base + Math.max(0, lower - upper) * circulation;
        if(topHeating)t += Math.max(0,upper-lower)*.2*rise*Math.sin(h*Math.PI);
        // Below an elevated heater, only slow local spreading is illustrated;
        // the buoyant circulation is above the source, not below it.
        if(!topHeating&&h<heaterHeight)t=20+(lower-20)*Math.exp(-(heaterHeight-h)*10)*(.25+.75*rise);
        t=clamp(t,20,Math.max(lower,upper));
        const encoded = Math.round(clamp((t - 20) / 80, 0, 1) * 65535), index = (row * FIELD_WIDTH + col) * 4;
        this.data[index] = encoded >> 8; this.data[index + 1] = encoded & 255;
        this.data[index + 2] = 0; this.data[index + 3] = 255;
      }
    }
    this.version++;
  }
  sample(x, h) {
    const col = clamp((x + 1) / 2, 0, 1) * (FIELD_WIDTH - 1), row = clamp(h, 0, 1) * (FIELD_HEIGHT - 1);
    const x0 = Math.floor(col), x1 = Math.min(x0 + 1, FIELD_WIDTH - 1), y0 = Math.floor(row), y1 = Math.min(y0 + 1, FIELD_HEIGHT - 1);
    const at = (cx, cy) => { const i = (cy * FIELD_WIDTH + cx) * 4; return this.data[i] * 256 + this.data[i + 1]; };
    return 20 + 80 / 65535 * mix(mix(at(x0, y0), at(x1, y0), col - x0), mix(at(x0, y1), at(x1, y1), col - x0), row - y0);
  }
}

// Closed streamlines: on the heated left side the tracers rise, on the right
// they descend. Their color is sampled at the actual position, not by phase.
export function convectionPosition(mode, particle, phase, heaterX = -.55, heaterHeight = 0) {
  const spec=FLUID_SPECS[mode], bottom=spec.centerY-spec.height/2;
  if(heaterHeight>=.97)heaterHeight=0; // No circulation, but particles still fill the fluid.
  if(particle.offset<heaterHeight*.45){
    const x=Math.sin(particle.phase)*spec.width*.42;
    return {x,y:bottom+spec.height*heaterHeight*(.15+.65*particle.offset/(heaterHeight*.45)),z:particle.z*.7};
  }
  const side=particle.offset<(heaterX+.92)/1.84?-1:1, edge=side*.92;
  const center=(heaterX+edge)/2, radius=Math.abs(edge-heaterX)/2;
  const a=particle.phase+phase*(.7+particle.offset*.4);
  const x=(center-side*radius*particle.ring*Math.cos(a))*spec.width/2;
  const y=bottom+spec.height*(heaterHeight+(1-heaterHeight)*(.5+.47*particle.ring*Math.sin(a)));
  const z=mode==='liquid'?particle.z*Math.sqrt(Math.max(0,1-(x/(spec.width/2))**2)):particle.z;
  return {x,y,z};
}

// Magnified, slowed microscopic motion superimposed on bulk circulation.
// This bounded, repeatable illustration is not a molecular dynamics solver.
// Time advances independently of the circulation phase, so top heating and
// regions below an elevated heater never imply zero thermal motion.
export function fluidParticlePosition(mode, particle, phase, time, temperature = 20, heaterX = -.55, heaterHeight = 0) {
  const p = convectionPosition(mode, particle, phase, heaterX, heaterHeight), spec = FLUID_SPECS[mode];
  const rate = Math.sqrt((Math.max(20, temperature) + 273.15) / 293.15);
  const t = time * rate, seed = particle.phase * 3.7 + particle.offset * 13, amplitude = mode === 'gas' ? .075 : .06;
  const wobble = (frequency, offset) => (Math.sin(t * frequency + seed + offset) + .5 * Math.sin(t * frequency * 2.31 + seed * 1.73 + offset)) / 1.5;
  p.x = clamp(p.x + amplitude * wobble(5.1, 0), -spec.width / 2 + .04, spec.width / 2 - .04);
  p.y = clamp(p.y + amplitude * wobble(6.3, 2), spec.centerY - spec.height / 2 + .04, spec.centerY + spec.height / 2 - .04);
  const depth = mode === 'liquid' ? Math.sqrt(Math.max(0, (spec.width / 2 - .02) ** 2 - p.x ** 2)) : 1.3;
  p.z = clamp(p.z + amplitude * wobble(4.7, 4), -depth, depth);
  return p;
}

export function radiationLayout(distance) {
  const sourceX = -2.5, targetX = sourceX + distance * 1.3;
  return { sourceX, targetX, barrierX: (sourceX + targetX) / 2, startX: sourceX + .54, endX: targetX - .065 };
}

export function radiationPosition(distance, shield, progress) {
  const layout = radiationLayout(distance), end = shield ? layout.barrierX - .045 : layout.endX;
  const f = ((progress % 1) + 1) % 1;
  // A reflecting screen returns the marker before it can reach the receiver.
  return mix(layout.startX, end, shield ? 1 - Math.abs(2 * f - 1) : f);
}
