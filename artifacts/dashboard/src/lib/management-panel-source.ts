/**
 * Which diagnosis the Assessment tab's "Suggested management (reference)" panel shows.
 *
 * The panel used to follow the leading PANE differential whenever its posterior reached 0.20, even
 * after the clinician had confirmed a different diagnosis: confirmed gallstone pancreatitis showed
 * the cholecystitis protocol (with antibiotics), a confirmed amoebic liver abscess showed the
 * appendicitis protocol, a groin aneurysm the hernia repair (clinical validation, 2026-09).
 *
 * Now the confirmed diagnosis wins — a locked working diagnosis or an ICD-10 code the clinician
 * recorded, exactly as PlanTab's confirmedPlanSource() reads it — and the PANE leader is used
 * only when nothing is confirmed. A confirmed diagnosis with no protocol shows no panel rather
 * than an unrelated one.
 *
 * No path-alias imports: the clinical-validation web runner (scripts/src/clinval) imports this.
 */

/** The fields of AppContext's WorkingDiagnosis this needs. */
export interface ConfirmableDiagnosis {
  diseaseId: string | null;
  icdCode: string | null;
  locked: boolean;
}

export interface PaneLeader {
  diseaseId: string;
  probability: number;
}

export interface ManagementPanelSource {
  diseaseId: string | null;
  icdCode: string | null;
  source: 'confirmed' | 'pane' | 'none';
}

/** PANE posterior at which an unconfirmed leader is shown (unchanged from AssessmentTab). */
export const PANE_PANEL_THRESHOLD = 0.20;

export function managementPanelSource(
  workingDiagnosis: ConfirmableDiagnosis | null | undefined,
  icdCodes: readonly string[],
  paneLeader: PaneLeader | null | undefined,
): ManagementPanelSource {
  const recordedIcd = icdCodes[0]?.split(' — ')[0]?.trim() || null;
  const wd = workingDiagnosis && workingDiagnosis.locked === true ? workingDiagnosis : null;
  const diseaseId = wd?.diseaseId ?? null;
  const icdCode = recordedIcd ?? wd?.icdCode ?? null;
  if (diseaseId || icdCode) return { diseaseId, icdCode, source: 'confirmed' };
  if (paneLeader && paneLeader.probability >= PANE_PANEL_THRESHOLD) {
    return { diseaseId: paneLeader.diseaseId, icdCode: null, source: 'pane' };
  }
  return { diseaseId: null, icdCode: null, source: 'none' };
}
