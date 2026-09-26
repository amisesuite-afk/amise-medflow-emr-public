/**
 * Shared wording for protocols (clinical validation 2026-09, owner decision G1.1: emergencies outside
 * surgery are RECOGNISED, first actions are SUGGESTED, and the patient is REDIRECTED — the clinic is
 * an outpatient general and endoscopic surgery practice, not an emergency department).
 *
 * Hospitals named: OKEU Hospital, St Jude's Hospital, Tapion Hospital (Victoria Hospital no longer
 * exists and must never be named).
 */

export const EMERGENCY_REDIRECT =
  'Outpatient clinic: this is an emergency — call 911 for an ambulance or arrange immediate transfer to the nearest emergency department (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital); start the first actions below while waiting and hand over in person.';

export const OBSTETRIC_REDIRECT =
  'Outpatient clinic: obstetric emergency — call 911 or arrange immediate transfer to a hospital with an obstetric unit (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital); inform the on-call obstetric team before arrival.';

/**
 * Penicillin-allergy alternative for intra-abdominal infection (IDSA/SIS 2010 complicated
 * intra-abdominal infection guideline; SIS 2017 revision). Drug choice only — doses per BNF and the
 * local antimicrobial policy.
 */
export const INTRA_ABDOMINAL_PENICILLIN_ALTERNATIVE =
  'Penicillin allergy (intra-abdominal infection, IDSA/SIS 2010; SIS 2017): ciprofloxacin + metronidazole, or gentamicin + metronidazole; a cephalosporin + metronidazole only if the reaction was not immediate/anaphylactic — doses per BNF and local microbiology policy. Surgical prophylaxis: a non-β-lactam regimen (e.g. gentamicin + metronidazole) at induction.';

export const PAEDIATRIC_REDIRECT =
  'Outpatient clinic: paediatric emergency — call 911 or arrange immediate transfer to the nearest emergency department with paediatric cover (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital); inform the paediatric / paediatric surgical team.';
