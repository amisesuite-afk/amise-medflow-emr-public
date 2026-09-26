/**
 * The "What's missing" rule content: the shared clinical rule file
 * clinical-content/rules/whats-missing-rules.json, read by iOS too (WhatsMissingRules.swift through
 * SharedClinicalContent). lint:shared-content checks it against its JSON Schema and against these
 * interfaces. Registered as `whats-missing`.
 */

import raw from '../../../../clinical-content/rules/whats-missing-rules.json';
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
  text: MissingText;
}

/** The wording of the strip ({placeholders} filled by the core). */
export interface MissingText {
  weightWhy: string;
  allergyWhy: string;
  pregnancyWhy: string;
  pregnancyReasonImaging: string;
  pregnancyReasonProcedure: string;
  pregnancyReasonDrugs: string;
  renalWhyDrugs: string;
  renalWhyContrast: string;
  anticoagWhy: string;
  supplementsWhy: string;
  decisionFlipWhy: string;
  decisionRefineWhy: string;
  riskScoreWhy: string;
  ferritinWhy: string;
  discriminatorWhat: string;
  discriminatorWhy: string;
  news2PartialWhy: string;
  news2NoneWhy: string;
  scoreWhy: string;
  scoreWhat: string;
  bandLabels: Record<string, string>;
}

export const WHATS_MISSING_RULES = raw as unknown as MissingRules;
export const WHATS_MISSING_VERSION: string = WHATS_MISSING_RULES.version;
