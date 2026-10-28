// Qualitative teaching model. Time and temperatures are illustrative, not calibrated.
import { TemperatureField, FLUID_PROBES } from './temperature-field.js';
import { createConductionGraph, PlateTemperatureField } from './conduction.js';
export const MATERIALS = { copper: { name: '구리', diffusion: 7 }, iron: { name: '철', diffusion: 1.8 }, wood: { name: '나무', diffusion: 0.075 } };
export class HeatModel {
  constructor(mode = 'solid', options = {}) { this.mode = mode; this.options = { power: 3, material: 'copper', shape: 'rod', position: 'bottom', heaterX: -.55, distance: 2, surface: 'dark', shield: false, ...options }; this.reset(); }
  reset() { this.time = 0; this.solid = createConductionGraph(this.options.shape); this.temperatures = Array(this.solid.positions.length).fill(20); this.lower = 20; this.upper = 20; this.target = 20; this.flow = 0; this.phase = 0; this.field ??= new TemperatureField(); this.plateField ??= new PlateTemperatureField(); this.fieldDirty = true; this.plateDirty = true; }
  get sourceTemperature() { return 40 + this.options.power * 10; }
  get heatingHeight() { return this.options.heaterHeight ?? (this.options.position === 'top' ? 1 : 0); }
  get temperatureField() { if (this.fieldDirty) { this.field.update(this.lower, this.upper, this.phase, this.flow, this.options.heaterX, this.heatingHeight); this.fieldDirty = false; } return this.field; }
  fluidTemperature(x, h) { return this.temperatureField.sample(x, h); }
  get solidField() { if (this.plateDirty) { this.plateField.update(this.temperatures); this.plateDirty = false; } return this.plateField; }
  get radiationExchange() {
    if (this.options.shield) return 0;
    const absorption = this.options.surface === 'dark' ? .9 : .22;
    // Net gray-body exchange, in Kelvin, with a small-source distance
    // approximation. The scale includes illustrative area / heat capacity.
    return .012 * absorption / this.options.distance ** 2 * 5.670374419e-8
      * ((this.sourceTemperature + 273.15) ** 4 - (this.target + 273.15) ** 4);
  }
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const steps = Math.ceil(dt / 0.025), h = dt / steps;
    for (let s = 0; s < steps; s++) {
      const p = this.options.power;
      if (this.mode === 'solid') {
        const old = this.temperatures, next = old.slice(), k = MATERIALS[this.options.material].diffusion;
        for (let i = 0; i < old.length; i++) { let exchange = 0; for (const j of this.solid.neighbors[i]) exchange += old[j] - old[i]; next[i] += h * (k * this.solid.weight * exchange - .004 * (old[i] - 20)); }
        const source = this.solid.source; next[source] += h * 5 * (this.sourceTemperature - old[source]); this.temperatures = next;
      } else if (this.mode === 'liquid' || this.mode === 'gas') {
        const bottom = this.heatingHeight < .97;
        const mixing = this.lower > this.upper ? .006 + .134 * (1 - this.heatingHeight) : .006;
        const exchange = mixing * (this.lower - this.upper);
        const heating = .03 * p * (this.sourceTemperature - (bottom ? this.lower : this.upper));
        this.lower += h * ((bottom ? heating : 0) - exchange - .008 * (this.lower - 20));
        this.upper += h * ((bottom ? 0 : heating) + exchange - .008 * (this.upper - 20));
        this.flow = bottom ? Math.min(1.15, Math.max(0, this.lower - this.upper) * .055) * (1 - this.heatingHeight) : 0;
        this.phase += this.flow * h;
      } else {
        this.target += h * (this.radiationExchange - .018 * (this.target - 20));
      }
      this.time += h;
    }
    this.fieldDirty = true;
    this.plateDirty = true;
  }
  get readings() { return this.mode === 'solid' ? this.solid.probes.map(i => this.temperatures[i]) : this.mode === 'radiation' ? [this.time > 0 ? this.sourceTemperature : 20, this.target, 20] : FLUID_PROBES.map(p => this.fluidTemperature(p.x, p.h)); }
}
