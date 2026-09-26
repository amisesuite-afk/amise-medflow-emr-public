/**
 * Tumour-marker upper limits for LabInterpretationPanel, through the practice reference ranges
 * (Settings → Reference ranges) with the built-in defaults as the fallback (CEA 5 ng/mL,
 * CA 19-9 37 U/mL, AFP 10 ng/mL, CA-125 35 U/mL, PSA 4 ng/mL — the numbers the panel used
 * before). Pure.
 */
import {
  resolveReferenceRange, unitMatchesRange, type RangeContext, type ReferenceRange,
} from '@workspace/triage-engine/reference-ranges';

export interface TumourMarkerDef {
  /** Label on the panel. */
  label: string;
  /** Catalogue saved name. */
  analyte: string;
  /** The unit the panel asks for. */
  unit: string;
  note: string;
}

export const TUMOUR_MARKERS: TumourMarkerDef[] = [
  { label: 'CEA',    analyte: 'CEA',     unit: 'ng/mL', note: 'Colorectal, gastric, lung, breast surveillance' },
  { label: 'CA19-9', analyte: 'CA 19-9', unit: 'U/mL',  note: 'Pancreatic/biliary; non-specific if <1000' },
  { label: 'AFP',    analyte: 'AFP',     unit: 'ng/mL', note: 'HCC surveillance; germ cell tumour' },
  { label: 'CA-125', analyte: 'CA-125',  unit: 'U/mL',  note: 'Ovarian surveillance (female only)' },
  { label: 'PSA',    analyte: 'PSA',     unit: 'ng/mL', note: 'Prostate screening (male only)' },
];

/** The marker's ULN in the panel's unit: the practice range when it is in that unit, else the default. */
export function tumourMarkerUpper(
  def: Pick<TumourMarkerDef, 'analyte' | 'unit'>,
  practice: ReadonlyArray<ReferenceRange>,
  ctx: RangeContext,
): number | null {
  // PSA is a male test: its range is looked up as male whatever the recorded sex.
  const c: RangeContext = def.analyte === 'PSA' ? { ...ctx, sex: 'male' } : ctx;
  const own = resolveReferenceRange(practice, def.analyte, c);
  if (own && own.upper !== null && unitMatchesRange(own, def.unit)) return own.upper;
  const dflt = resolveReferenceRange([], def.analyte, c);
  return dflt && dflt.upper !== null && unitMatchesRange(dflt, def.unit) ? dflt.upper : null;
}
