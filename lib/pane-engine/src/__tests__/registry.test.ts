import { describe, it, expect, beforeAll } from 'vitest';

describe('vademecum registry', () => {
  let DISEASES: Awaited<ReturnType<typeof import('../vademecum/index.js').DISEASES.map>>;
  let FEATURES: Awaited<ReturnType<typeof import('../vademecum/index.js').FEATURES.map>>;

  beforeAll(async () => {
    const mod = await import('../vademecum/index.js');
    DISEASES = mod.DISEASES as unknown as typeof DISEASES;
    FEATURES = mod.FEATURES as unknown as typeof FEATURES;
  });

  it('registers at least 79 diseases (80 specialties × 10 + _other_)', async () => {
    const { DISEASES: D } = await import('../vademecum/index.js');
    expect(D.length).toBeGreaterThanOrEqual(79);
  });

  it('includes _other_ catch-all', async () => {
    const { DISEASES: D } = await import('../vademecum/index.js');
    expect(D.some(d => d.id === '_other_')).toBe(true);
  });

  it('deduplicates diseases with the same id', async () => {
    const { DISEASES: D } = await import('../vademecum/index.js');
    const ids = D.map(d => d.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it('deduplicates features with the same id', async () => {
    const { FEATURES: F } = await import('../vademecum/index.js');
    const ids = F.map(f => f.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it('all disease priors are positive', async () => {
    const { DISEASES: D } = await import('../vademecum/index.js');
    expect(D.every(d => d.prior > 0)).toBe(true);
  });

  it('contains diseases from multiple specialties', async () => {
    const { DISEASES: D } = await import('../vademecum/index.js');
    const ids = new Set(D.map(d => d.id));
    expect(ids.has('appendicitis')).toBe(true);         // general surgery
    expect(ids.has('cholangiocarcinoma')).toBe(true);   // hepatobiliary
    expect(ids.has('haemorrhoids')).toBe(true);         // colorectal
    expect(ids.has('femoral_hernia')).toBe(true);       // hernia
    expect(ids.has('fibroadenoma')).toBe(true);         // breast
    expect(ids.has('thyroid_carcinoma')).toBe(true);    // endocrine
    expect(ids.has('varicose_veins')).toBe(true);       // vascular
    expect(ids.has('ovarian_cyst')).toBe(true);         // gynaecology
  });
});
