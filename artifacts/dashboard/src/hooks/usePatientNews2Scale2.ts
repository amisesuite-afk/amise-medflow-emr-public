/**
 * The loaded patient's NEWS2 SpO₂ Scale 2 opt-in, read from `patients.news2_spo2_scale2`
 * (Migration 88; set by a clinician in the iOS app). Read-only.
 *
 * `available` is false while loading, with no saved patient, or when the column is not on the
 * server yet — NEWS2 displays then keep their manual Scale 2 opt-in.
 */
import { useEffect, useState } from 'react';
import { loadPatientNews2Scale2 } from '@/lib/db';

export interface PatientNews2Scale2 {
  available: boolean;
  useScale2: boolean;
}

const UNAVAILABLE: PatientNews2Scale2 = { available: false, useScale2: false };

export function usePatientNews2Scale2(patientId: string | null | undefined): PatientNews2Scale2 {
  const [state, setState] = useState<{ id: string | null; value: PatientNews2Scale2 }>({ id: null, value: UNAVAILABLE });

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    void loadPatientNews2Scale2(patientId).then(value => {
      if (!cancelled) setState({ id: patientId, value });
    });
    return () => { cancelled = true; };
  }, [patientId]);

  // Never show another patient's flag while the new one loads.
  return patientId && state.id === patientId ? state.value : UNAVAILABLE;
}
