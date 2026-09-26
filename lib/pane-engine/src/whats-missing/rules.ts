/**
 * The "What's missing" rule content (whats-missing-rules.json; byte-identical iOS copy
 * ios/AmiseMedFlow/Resources/WhatsMissingRules.json, pinned by scripts/src/whats-missing-parity.test.ts).
 */

import raw from './whats-missing-rules.json';
import type { MissingAction, MissingTier } from './types.js';

export interface MissingGroupRule {
  id: string;
  tier: MissingTier;
  safetyOrder?: number;
  what: string;
  partsWhat?: string;
  action: MissingAction;
  alt?: MissingAction;
}

export interface MissingRules {
  version: string;
  status: string;
  topN: number;
  tiers: MissingTier[];
  groups: MissingGroupRule[];
  concepts: { id: string; group: string; part: string }[];
  scores: { id: string; label: string }[];
  decisionInputs: { key: string; group: string; concept?: string; concepts?: string[]; probe: number | string }[];
  thresholds: {
    pregnancyAgeMin: number; pregnancyAgeMax: number; weightAgeBelow: number;
    alvaradoFeverC: number; alvaradoWbc: number; alvaradoNeutrophilPct: number;
    airFeverC: number; airPmnPct: [number, number]; airWbc: [number, number]; airCrp: [number, number];
    gbsHrAbove: number;
    curbUreaAbove: number; curbRrAtLeast: number; curbSbpBelow: number; curbDbpAtMost: number; curbAgeAtLeast: number;
    wellsPeHrAbove: number; capriniBmiAbove: number; rcriCreatinineAbove: number;
    bisapUreaAbove: number; bisapAgeAbove: number;
    sirsTempBelow: number; sirsTempAbove: number; sirsHrAbove: number; sirsRrAbove: number; sirsWbcBelow: number; sirsWbcAbove: number;
    neutrophilAbsoluteMax: number;
  };
  terms: {
    anticoagulants: string[];
    renalDrugs: string[];
    nsaids: string[];
    ionisingImaging: string[];
    contrast: string[];
    insulinDrugs: string[];
    lastDose: string[];
    history: Record<string, string[]>;
    findings: Record<string, string[]>;
    pleuralEffusion: string[];
  };
  text: Record<string, string> & { bandLabels: Record<string, string> };
}

export const WHATS_MISSING_RULES = raw as unknown as MissingRules;
export const WHATS_MISSING_VERSION: string = WHATS_MISSING_RULES.version;
