import type { DiseaseNode, Feature } from '../types.js';

export interface DiseaseModule {
  specialty: string;
  system: string;
  diseases: DiseaseNode[];
  features: Feature[];
}

const _diseases: DiseaseNode[] = [];
const _features: Feature[] = [];
const _seenD = new Set<string>();
const _seenF = new Set<string>();
const _specialtyMap = new Map<string, string>();

export function registerModule(mod: DiseaseModule): void {
  for (const d of mod.diseases) {
    if (!_seenD.has(d.id)) {
      _diseases.push(d);
      _seenD.add(d.id);
      _specialtyMap.set(d.id, mod.specialty);
    }
  }
  for (const f of mod.features) {
    if (!_seenF.has(f.id)) { _features.push(f); _seenF.add(f.id); }
  }
}

/** Returns the accumulated disease list (snapshot at call time). */
export function getRegisteredDiseases(): DiseaseNode[] { return _diseases; }
/** Returns the accumulated feature list (snapshot at call time). */
export function getRegisteredFeatures(): Feature[] { return _features; }
/** Returns the specialty key for a registered disease id, or 'other' if unknown. */
export function getDiseaseSpecialty(id: string): string { return _specialtyMap.get(id) ?? 'other'; }
