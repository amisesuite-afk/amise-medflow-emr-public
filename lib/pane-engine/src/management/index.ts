import { generalSurgeryProtocols } from './protocols/generalSurgery.js';
import { hepatobiliaryProtocols } from './protocols/hepatobiliary.js';
import { colorectalProtocols, herniaProtocols, breastProtocols } from './protocols/colorectalHerniaBreast.js';
import { endocrineProtocols } from './protocols/endocrine.js';
import { vascularProtocols } from './protocols/vascular.js';
import { gynaecologyProtocols } from './protocols/gynaecology.js';
import { traumaProtocols } from './protocols/trauma.js';
import { upperGIProtocols } from './protocols/upperGI.js';
import { skinSoftTissueProtocols } from './protocols/skinSoftTissue.js';
import { urologyProtocols } from './protocols/urology.js';
import { postOpWoundsProtocols } from './protocols/postOpWounds.js';

export type { ManagementProtocol, InvestigationItem, ManagementStep } from './types.js';

const ALL_PROTOCOLS = [
  ...generalSurgeryProtocols,
  ...hepatobiliaryProtocols,
  ...colorectalProtocols,
  ...herniaProtocols,
  ...breastProtocols,
  ...endocrineProtocols,
  ...vascularProtocols,
  ...gynaecologyProtocols,
  ...traumaProtocols,
  ...upperGIProtocols,
  ...skinSoftTissueProtocols,
  ...urologyProtocols,
  ...postOpWoundsProtocols,
];

const _byDiseaseId = new Map(ALL_PROTOCOLS.map(p => [p.diseaseId, p]));

export function getProtocol(diseaseId: string) {
  return _byDiseaseId.get(diseaseId) ?? null;
}

export function getProtocolByIcd(icdCode: string) {
  const code = icdCode.split(' ')[0].trim();
  return ALL_PROTOCOLS.find(p => p.icd10Prefixes.some(prefix => code.startsWith(prefix))) ?? null;
}

export function getAllProtocols() {
  return ALL_PROTOCOLS;
}
