// St. Lucia phone validation and formatting
export const SL_PREFIXES_DIGICEL = ['285','286','287','484','485','487','488','489','584','585','718','719','720','721','722','723','724','725','726','727','728'];
export const SL_PREFIXES_FLOW = ['452','453','454','455','456','457','458','459','460'];

export function formatSlPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 7) return `+1 (758) ${digits.slice(0,3)}-${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith('758')) return `+1 (758) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1758')) return `+1 (758) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

export function isValidSlPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const local7 =
    digits.length === 7 ? digits :
    digits.length === 10 && digits.startsWith('758') ? digits.slice(3) :
    digits.length === 11 && digits.startsWith('1758') ? digits.slice(4) : '';
  if (!local7 || local7.length !== 7) return false;
  const prefix = local7.slice(0,3);
  return [...SL_PREFIXES_DIGICEL, ...SL_PREFIXES_FLOW].includes(prefix);
}

// Quarters and communities
export interface SlCommunity { quarter: string; community: string; }
export const SL_COMMUNITIES: SlCommunity[] = [
  // Castries
  { quarter: 'Castries', community: 'Castries City' },
  { quarter: 'Castries', community: 'Entrepot' },
  { quarter: 'Castries', community: 'Ciceron' },
  { quarter: 'Castries', community: 'La Toc' },
  { quarter: 'Castries', community: 'Vigie' },
  { quarter: 'Castries', community: 'Choc Bay' },
  { quarter: 'Castries', community: 'Bisee' },
  { quarter: 'Castries', community: 'Marchand' },
  { quarter: 'Castries', community: 'Balata' },
  { quarter: 'Castries', community: 'La Clery' },
  { quarter: 'Castries', community: 'Conway' },
  { quarter: 'Castries', community: 'Sans Souci' },
  // Babonneau
  { quarter: 'Babonneau', community: 'Babonneau' },
  { quarter: 'Babonneau', community: "Bois d'Orange" },
  { quarter: 'Babonneau', community: 'Fond Assau' },
  { quarter: 'Babonneau', community: 'La Guerre' },
  // Gros Islet
  { quarter: 'Gros Islet', community: 'Gros Islet Town' },
  { quarter: 'Gros Islet', community: 'Rodney Bay' },
  { quarter: 'Gros Islet', community: 'Beausejour' },
  { quarter: 'Gros Islet', community: 'Cap Estate' },
  { quarter: 'Gros Islet', community: 'Corinth' },
  { quarter: 'Gros Islet', community: 'Monchy' },
  { quarter: 'Gros Islet', community: 'Marisule' },
  { quarter: 'Gros Islet', community: 'Reduit' },
  { quarter: 'Gros Islet', community: 'Massade' },
  // Vieux Fort
  { quarter: 'Vieux Fort', community: 'Vieux Fort Town' },
  { quarter: 'Vieux Fort', community: 'Augier' },
  { quarter: 'Vieux Fort', community: 'Beane Field' },
  { quarter: 'Vieux Fort', community: 'Grace' },
  { quarter: 'Vieux Fort', community: 'Labor' },
  { quarter: 'Vieux Fort', community: 'Banse' },
  { quarter: 'Vieux Fort', community: 'Pierrot' },
  // Soufrière
  { quarter: 'Soufrière', community: 'Soufrière Town' },
  { quarter: 'Soufrière', community: 'Fond St Jacques' },
  { quarter: 'Soufrière', community: 'Etangs' },
  { quarter: 'Soufrière', community: 'Millet' },
  { quarter: 'Soufrière', community: 'Ravine Claire' },
  { quarter: 'Soufrière', community: 'Anse Chastanet' },
  // Micoud
  { quarter: 'Micoud', community: 'Micoud Town' },
  { quarter: 'Micoud', community: 'Desruisseaux' },
  { quarter: 'Micoud', community: 'Mon Repos' },
  { quarter: 'Micoud', community: 'Augier' },
  { quarter: 'Micoud', community: 'Blanchard' },
  // Dennery
  { quarter: 'Dennery', community: 'Dennery Village' },
  { quarter: 'Dennery', community: 'Praslin' },
  { quarter: 'Dennery', community: "Fond d'Or" },
  { quarter: 'Dennery', community: 'La Caye' },
  { quarter: 'Dennery', community: 'Aux Leon' },
  // Anse-la-Raye
  { quarter: 'Anse-la-Raye', community: 'Anse-la-Raye Town' },
  { quarter: 'Anse-la-Raye', community: 'Canaries' },
  { quarter: 'Anse-la-Raye', community: 'Jacmel' },
  { quarter: 'Anse-la-Raye', community: 'Vanard' },
  // Choiseul
  { quarter: 'Choiseul', community: 'Choiseul Town' },
  { quarter: 'Choiseul', community: 'Balenbouche' },
  { quarter: 'Choiseul', community: 'La Fargue' },
  { quarter: 'Choiseul', community: 'Fiette' },
  // Laborie
  { quarter: 'Laborie', community: 'Laborie Town' },
  { quarter: 'Laborie', community: 'Piton' },
  { quarter: 'Laborie', community: 'Saltibus' },
  { quarter: 'Laborie', community: 'Esperance' },
];

export const SL_QUARTERS = [...new Set(SL_COMMUNITIES.map(c => c.quarter))];

// Referral doctors / healthcare providers in Saint Lucia
export interface SlDoctor {
  name: string;
  specialty: string;
  institution: string;
  phone: string;
}

export const SL_DOCTORS: SlDoctor[] = [
  { name: 'Dr. Dawit D. Kabiye', specialty: 'General & Endoscopic Surgery', institution: 'Amise Medical', phone: '+1 (758) 384-1234' },
  { name: 'OKEU Hospital A&E', specialty: 'Emergency', institution: 'OKEU Hospital, Castries', phone: '+1 (758) 452-2421' },
  { name: "St Jude's Hospital A&E", specialty: 'Emergency', institution: "St Jude's Hospital, Vieux Fort", phone: '+1 (758) 454-6041' },
  { name: 'Dr. R. Lee', specialty: 'Internal Medicine', institution: 'OKEU Hospital', phone: '+1 (758) 485-XXXX' },
  { name: 'Dr. A. Charles', specialty: 'Obstetrics & Gynaecology', institution: 'Tapion Hospital', phone: '+1 (758) 459-2000' },
  { name: 'Tapion Hospital', specialty: 'Private Hospital', institution: 'Tapion, Castries', phone: '+1 (758) 459-2000' },
  { name: 'Lamina Medical Centre', specialty: 'Private Clinic', institution: 'Rodney Bay', phone: '+1 (758) 452-8621' },
  { name: 'St. Louis Medical Centre', specialty: 'Private Clinic', institution: 'Castries', phone: '+1 (758) 452-4000' },
  { name: 'Heraldine Rock Polyclinic', specialty: 'Polyclinic', institution: 'Castries', phone: '+1 (758) 452-3756' },
  { name: 'Gros Islet Polyclinic', specialty: 'Polyclinic', institution: 'Gros Islet', phone: '+1 (758) 450-8257' },
  { name: 'Vieux Fort Polyclinic', specialty: 'Polyclinic', institution: 'Vieux Fort', phone: '+1 (758) 454-6242' },
  { name: 'Dennery Polyclinic', specialty: 'Polyclinic', institution: 'Dennery', phone: '+1 (758) 453-3310' },
];
