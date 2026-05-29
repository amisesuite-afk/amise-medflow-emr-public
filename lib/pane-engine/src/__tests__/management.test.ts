import { describe, it, expect } from 'vitest';
import { getProtocol, getProtocolByIcd } from '../management/index.js';

describe('management protocol lookup', () => {
  it('getProtocol returns non-null for appendicitis', () => {
    const p = getProtocol('appendicitis');
    expect(p).not.toBeNull();
    expect(p!.diseaseId).toBe('appendicitis');
  });

  it('protocol for appendicitis has investigations', () => {
    const p = getProtocol('appendicitis');
    expect(p!.investigations.length).toBeGreaterThan(0);
  });

  it('protocol for appendicitis has management steps', () => {
    const p = getProtocol('appendicitis');
    expect(p!.management.length).toBeGreaterThan(0);
  });

  it('protocol for appendicitis has keyPoints and redFlags', () => {
    const p = getProtocol('appendicitis');
    expect(p!.keyPoints.length).toBeGreaterThan(0);
    expect(p!.redFlags.length).toBeGreaterThan(0);
  });

  it('getProtocolByIcd("K35") resolves to appendicitis', () => {
    const p = getProtocolByIcd('K35');
    expect(p).not.toBeNull();
    expect(p!.diseaseId).toBe('appendicitis');
  });

  it('getProtocolByIcd with full ICD code prefix-matches', () => {
    const p = getProtocolByIcd('K35.89');
    expect(p).not.toBeNull();
    expect(p!.diseaseId).toBe('appendicitis');
  });

  it('getProtocol returns null for unknown disease', () => {
    expect(getProtocol('not_a_real_disease')).toBeNull();
  });

  it('getProtocolByIcd returns null for unknown code', () => {
    expect(getProtocolByIcd('Z99.999')).toBeNull();
  });

  it('all specialties have protocols registered', () => {
    const ids = [
      // General surgery
      'cholecystitis', 'pancreatitis',
      // Hepatobiliary
      'choledocholithiasis', 'pancreatic_carcinoma',
      // Colorectal
      'haemorrhoids', 'crohns_disease',
      // Hernia
      'femoral_hernia', 'umbilical_hernia',
      // Breast
      'fibroadenoma', 'mastitis',
      // Endocrine
      'thyroid_carcinoma', 'hyperthyroidism',
      // Vascular
      'varicose_veins', 'deep_vein_thrombosis',
      // Gynaecology
      'ovarian_torsion', 'endometriosis',
      // Trauma
      'traumatic_brain_injury', 'thermal_burn_major',
    ];
    for (const id of ids) {
      expect(getProtocol(id), `missing protocol for ${id}`).not.toBeNull();
    }
  });

  it('getProtocol returns non-null for traumatic_brain_injury', () => {
    const p = getProtocol('traumatic_brain_injury');
    expect(p).not.toBeNull();
    expect(p!.diseaseId).toBe('traumatic_brain_injury');
  });

  it('getProtocol returns non-null for thermal_burn_major', () => {
    const p = getProtocol('thermal_burn_major');
    expect(p).not.toBeNull();
    expect(p!.diseaseId).toBe('thermal_burn_major');
  });

  it('urgency values are valid', () => {
    const p = getProtocol('appendicitis');
    const valid = new Set(['stat', 'urgent', 'routine']);
    p!.investigations.forEach(inv => {
      expect(valid.has(inv.urgency), `invalid urgency: ${inv.urgency}`).toBe(true);
    });
  });

  it('phase values are valid', () => {
    const p = getProtocol('appendicitis');
    const valid = new Set(['immediate', 'conservative', 'surgical', 'followup']);
    p!.management.forEach(step => {
      expect(valid.has(step.phase), `invalid phase: ${step.phase}`).toBe(true);
    });
  });
});
