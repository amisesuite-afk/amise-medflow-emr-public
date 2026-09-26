/**
 * History frames: the history-of-presenting-complaint structure for a chief complaint.
 * See types.ts for the model and docs/clinical-validation/changes/history-by-complaint.md.
 */

import { HISTORY_FRAMES } from './frames';
import { classifyComplaint } from './classify';
import type { FrameChoice, FrameDimension, FrameOption, HistoryFrame } from './types';

export * from './types';
export { HISTORY_FRAMES, HISTORY_FRAMES_VERSION } from './frames';
export {
  CLASSIFIER_RULES, PAIN_REGION_RULES, PAIN_SYSTEM_DEFAULTS, VARIANT_RULES, classifyComplaint, firstPosition,
  frameIdFor, keywordPosition,
} from './classify';

const BY_ID = new Map(HISTORY_FRAMES.map(f => [f.id, f]));

export function getFrame(id: string): HistoryFrame | undefined {
  return BY_ID.get(id);
}

/** iOS socratesSelections key of a dimension. */
export function dimensionKey(dim: FrameDimension): string {
  return dim.key ?? dim.id;
}

/** iOS stored value and key of a chip. */
export function optionValue(opt: FrameOption): string {
  return opt.value ?? opt.label;
}
export function optionKey(dim: FrameDimension, opt: FrameOption): string {
  return opt.key ?? dimensionKey(dim);
}

/** Web answer keys of the pain dimensions (ChiefComplaintStrip / HpiTab / socrates-to-features). */
const WEB_PAIN_KEYS: Record<string, string> = {
  associations: 'assoc', exacerbating: 'triggers', relieving: 'relief',
};

/** Web answer key of a dimension. */
export function webKeyFor(dim: FrameDimension): string {
  return dim.webKey ?? WEB_PAIN_KEYS[dim.id] ?? dim.id;
}

/** The chip as the web stores it: parenthetical hints removed (ChiefComplaintStrip chipLabel / HpiTab strip). */
export function webStoredLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)/g, '').trim();
}

/** A dimension shown for a secondary symptom ("Also: cough — Character"). Ids are prefixed. */
export interface ResolvedDimension extends FrameDimension {
  /** Frame the dimension comes from. */
  frameId: string;
  /** True for a secondary symptom's dimension. */
  secondary: boolean;
}

export interface ResolvedFrame {
  choice: FrameChoice;
  frame: HistoryFrame;
  /** Primary frame dimensions, then each secondary frame's secondaryDims. */
  dimensions: ResolvedDimension[];
}

/**
 * The frame for a complaint, with the associated-symptom chips of the other symptoms it names.
 * `overrideFrameId` is the clinician's one-tap switch.
 */
export function resolveFrame(complaint: string, system?: string, overrideFrameId?: string | null): ResolvedFrame {
  const choice = classifyComplaint(complaint, system);
  const frame = (overrideFrameId && BY_ID.get(overrideFrameId)) || BY_ID.get(choice.frameId) || BY_ID.get('general')!;
  const dims: ResolvedDimension[] = frame.dimensions.map(dm => ({ ...dm, frameId: frame.id, secondary: false }));
  const usedWebKeys = new Set(dims.map(webKeyFor));
  for (const secId of choice.secondary) {
    if (secId === frame.id) continue;
    const sec = BY_ID.get(secId);
    if (!sec || sec.type === frame.type) continue;
    for (const id of sec.secondaryDims) {
      const dm = sec.dimensions.find(x => x.id === id);
      if (!dm) continue;
      const webKey = webKeyFor(dm);
      if (usedWebKeys.has(webKey)) continue;
      usedWebKeys.add(webKey);
      dims.push({
        ...dm, id: `${sec.id}.${dm.id}`, key: dimensionKey(dm), webKey,
        title: `${sec.label} — ${dm.title}`, frameId: sec.id, secondary: true,
      });
    }
  }
  return { choice, frame, dimensions: dims };
}

/** Frames offered by the one-tap switch, in display order. */
export function switchableFrames(): { id: string; label: string }[] {
  return HISTORY_FRAMES.map(f => ({ id: f.id, label: f.label }));
}

/** The option a stored value belongs to in a frame (a legacy alias resolves to its current option). */
export function optionForStored(frame: HistoryFrame, key: string, stored: string): FrameOption | undefined {
  for (const dm of frame.dimensions) {
    for (const op of dm.options) {
      if (optionKey(dm, op) === key && optionValue(op) === stored) return op;
    }
  }
  const alias = frame.aliases?.find(a => a.key === key && a.legacy === stored);
  if (!alias) return undefined;
  for (const dm of frame.dimensions) {
    const op = dm.options.find(x => x.label === alias.current);
    if (op) return op;
  }
  return undefined;
}
