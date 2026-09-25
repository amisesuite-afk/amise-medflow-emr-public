// Side-effect imports populate the registry. _other must be first.
import './_other.js';
import './specialties/generalSurgery.js';
import './specialties/hepatobiliary.js';
import './specialties/colorectal.js';
import './specialties/hernia.js';
import './specialties/breast.js';
import './specialties/endocrine.js';
import './specialties/vascular.js';
import './specialties/gynaecology.js';
import './specialties/trauma.js';
import './specialties/upperGI.js';
import './specialties/skinSoftTissue.js';
import './specialties/urology.js';
import './specialties/postOpWounds.js';
// Pane model 1.0.0: non-surgical specialties, so the differential is condition-neutral.
import './specialties/cardiovascular.js';
import './specialties/respiratory.js';
import './specialties/acuteMedicine.js';
import './specialties/metabolic.js';
import './specialties/neurology.js';
import './specialties/obstetrics.js';
import './specialties/paediatrics.js';

import { getRegisteredDiseases, getRegisteredFeatures } from './registry.js';

export const DISEASES = getRegisteredDiseases();
export const FEATURES = getRegisteredFeatures();
