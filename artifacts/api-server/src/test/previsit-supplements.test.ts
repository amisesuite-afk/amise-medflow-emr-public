// The pre-visit form's herbs / bush teas / supplements answer is stored as one marked row of
// previsit_submissions.medications (no new column); meds_complete keeps counting medicines only.
import { describe, it, expect } from 'vitest';
import { previsitSupplementRow, PREVISIT_SUPPLEMENT_INDICATION } from '../routes/previsit.js';

describe('previsitSupplementRow', () => {
  it('records yes / no / not sure with the marker indication', () => {
    expect(previsitSupplementRow({ answer: 'yes', details: ' garlic tablets, cerasee tea ' }))
      .toEqual({ name: 'garlic tablets, cerasee tea', dose: '', frequency: '', indication: PREVISIT_SUPPLEMENT_INDICATION });
    expect(previsitSupplementRow({ answer: 'yes' })?.name).toBe('Yes (not named)');
    expect(previsitSupplementRow({ answer: 'no', details: 'ignored' })?.name).toBe('None');
    expect(previsitSupplementRow({ answer: 'unsure', details: 'bush tea from market' })?.name).toBe('Not sure — bush tea from market');
  });

  it('ignores a missing or unknown answer and caps free text', () => {
    expect(previsitSupplementRow(undefined)).toBeNull();
    expect(previsitSupplementRow({ answer: 'maybe' })).toBeNull();
    expect(previsitSupplementRow({ answer: 'yes', details: 'x'.repeat(900) })?.name.length).toBe(500);
  });
});
