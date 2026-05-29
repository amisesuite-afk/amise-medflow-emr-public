import { registerModule } from './registry.js';

// Must be imported first so _other_ is always present regardless of which
// specialties are loaded. Prior is a raw weight; initPaneState normalises.
registerModule({
  specialty: 'catchall',
  system: 'other',
  diseases: [{
    id: '_other_',
    label: 'Other / undetermined',
    icd10: 'R69',
    prior: 0.20,
    features: {},
  }],
  features: [],
});
