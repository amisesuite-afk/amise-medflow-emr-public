import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProcType = 'ogd' | 'colonoscopy' | 'ercp' | 'preop' | 'postop' | 'other';

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fld">
      <label style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function ChipRow({ chips, value, onToggle }: { chips: string[]; value: string[]; onToggle: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
      {chips.map(chip => {
        const on = value.includes(chip);
        return (
          <button key={chip} type="button" onClick={() => onToggle(chip)} style={{
            padding: '3px 10px', borderRadius: 12,
            border: on ? '1px solid #0d9488' : '1px solid #d1d5db',
            background: on ? '#0d9488' : '#f9fafb',
            color: on ? '#fff' : '#374151',
            fontSize: 11, fontWeight: on ? 600 : 400, cursor: 'pointer',
          }}>{chip}</button>
        );
      })}
    </div>
  );
}

function SelectOpts({ chips, value, onChange }: { chips: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 12 }}>
      <option value="">— select —</option>
      {chips.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// ── OGD form ──────────────────────────────────────────────────────────────────

interface OgdData {
  indication: string; sedation: string; sedationType: string;
  oesophagus: string[]; stomach: string[]; duodenum: string[];
  zLine: string; hiatalHernia: string;
  biopsy: string; biopsySite: string;
  cloTest: string; hpylori: string;
  complications: string[]; additionalNotes: string;
}

const EMPTY_OGD: OgdData = {
  indication: '', sedation: '', sedationType: '',
  oesophagus: [], stomach: [], duodenum: [],
  zLine: '', hiatalHernia: '', biopsy: '', biopsySite: '',
  cloTest: '', hpylori: '', complications: [], additionalNotes: '',
};

function OgdForm({ data, onChange }: { data: OgdData; onChange: (d: OgdData) => void }) {
  function set<K extends keyof OgdData>(k: K, v: OgdData[K]) { onChange({ ...data, [k]: v }); }
  function toggleArr(k: 'oesophagus' | 'stomach' | 'duodenum' | 'complications', c: string) {
    const cur = data[k];
    set(k, cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Indication">
          <SelectOpts chips={['Dyspepsia', 'Dysphagia', 'Haematemesis', 'Anaemia workup', "Barrett's surveillance", 'Gastric ulcer follow-up', 'Oesophageal stricture', 'H. pylori testing', 'Post-op surveillance', 'Weight loss workup']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Sedation">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            {['None (unsedated)', 'Topical spray only', 'Conscious sedation', 'GA / propofol'].map(s => (
              <label key={s} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="radio" name="ogd-sed" checked={data.sedationType === s} onChange={() => set('sedationType', s)} /> {s}
              </label>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Oesophagus findings">
        <ChipRow chips={['Normal', 'Oesophagitis grade A', 'Oesophagitis grade B', 'Oesophagitis grade C', 'Oesophagitis grade D', "Barrett's oesophagus", 'Stricture', 'Varices', 'Ulcer', 'Hiatal hernia', 'Candidiasis', 'Extrinsic compression', 'Mass / polyp']}
          value={data.oesophagus} onToggle={c => toggleArr('oesophagus', c)} />
      </Field>

      <Field label="Z-line / GEJ">
        <ChipRow chips={['Normal (at diaphragm)', 'Irregular Z-line', "Short segment Barrett's", "Long segment Barrett's", 'Hiatal hernia (cm): see notes']}
          value={[data.zLine]} onToggle={v => set('zLine', v)} />
      </Field>

      <Field label="Stomach findings">
        <ChipRow chips={['Normal', 'Gastritis (antral)', 'Gastritis (diffuse)', 'Ulcer (lesser curve)', 'Ulcer (greater curve)', 'Ulcer (antrum)', 'Polyp', 'Atrophic mucosa', 'Intestinal metaplasia', 'Mass', 'Surgical changes']}
          value={data.stomach} onToggle={c => toggleArr('stomach', c)} />
      </Field>

      <Field label="Duodenum findings">
        <ChipRow chips={['Normal', 'Duodenitis', 'Duodenal ulcer (D1)', 'Duodenal ulcer (D2)', 'Erosions', 'Polyp', 'Mass', 'Mucosal nodularity', 'Bile reflux']}
          value={data.duodenum} onToggle={c => toggleArr('duodenum', c)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Biopsy taken">
          <ChipRow chips={['Yes', 'No']} value={[data.biopsy]} onToggle={v => set('biopsy', v)} />
        </Field>
        <Field label="Biopsy site(s)">
          <input type="text" value={data.biopsySite} onChange={e => set('biopsySite', e.target.value)}
            placeholder="e.g. antrum ×2, Z-line ×4" style={{ fontSize: 12 }} />
        </Field>
        <Field label="CLO test / H. pylori">
          <ChipRow chips={['Positive', 'Negative', 'Not done']} value={[data.cloTest]} onToggle={v => set('cloTest', v)} />
        </Field>
      </div>

      <Field label="Complications">
        <ChipRow chips={['None', 'Bleeding', 'Perforation', 'Aspiration', 'Respiratory depression', 'Poor tolerance', 'Incomplete procedure']}
          value={data.complications} onToggle={c => toggleArr('complications', c)} />
      </Field>

      <Field label="Additional findings / plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Free text findings, biopsy plan, next steps…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Colonoscopy form ──────────────────────────────────────────────────────────

interface ColonData {
  indication: string; prepQuality: string; sedationType: string;
  cecalIntubation: string; intubationTimeMin: string; withdrawalTimeMin: string;
  ileoscopy: string; appendixOrifice: string;
  findings: string[];
  polyps: { site: string; size: string; morphology: string; intervention: string }[];
  tattoo: string; tattooSite: string;
  complications: string[]; additionalNotes: string;
}

const EMPTY_COLON: ColonData = {
  indication: '', prepQuality: '', sedationType: '',
  cecalIntubation: '', intubationTimeMin: '', withdrawalTimeMin: '',
  ileoscopy: '', appendixOrifice: '',
  findings: [],
  polyps: [],
  tattoo: '', tattooSite: '',
  complications: [], additionalNotes: '',
};

function ColonForm({ data, onChange }: { data: ColonData; onChange: (d: ColonData) => void }) {
  function set<K extends keyof ColonData>(k: K, v: ColonData[K]) { onChange({ ...data, [k]: v }); }
  function toggleArr(k: 'findings' | 'complications', c: string) {
    const cur = data[k];
    set(k, cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  }
  function addPolyp() {
    set('polyps', [...data.polyps, { site: '', size: '', morphology: '', intervention: '' }]);
  }
  function updatePolyp(i: number, field: string, v: string) {
    const updated = data.polyps.map((p, idx) => idx === i ? { ...p, [field]: v } : p);
    set('polyps', updated);
  }
  function removePolyp(i: number) {
    set('polyps', data.polyps.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Indication">
          <SelectOpts chips={['Colorectal cancer screening', 'Polyp surveillance', 'Rectal bleeding', 'Change in bowel habit', 'Anaemia workup', 'IBD surveillance', 'Diarrhoea workup', 'Diverticular disease', 'Post-resection surveillance', 'Iron deficiency anaemia']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Bowel prep quality (Boston BSS)">
          <ChipRow chips={['Excellent (≥8)', 'Adequate (6–7)', 'Poor (3–5)', 'Inadequate (<3)', 'Repeat required']}
            value={[data.prepQuality]} onToggle={v => set('prepQuality', v)} />
        </Field>
      </div>

      <Field label="Sedation">
        <ChipRow chips={['None', 'Entonox', 'Conscious sedation', 'GA / propofol']}
          value={[data.sedationType]} onToggle={v => set('sedationType', v)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Field label="Caecal intubation">
          <ChipRow chips={['Yes', 'No — splenic flexure', 'No — hepatic flexure', 'No — sigmoid']}
            value={[data.cecalIntubation]} onToggle={v => set('cecalIntubation', v)} />
        </Field>
        <Field label="Time to caecum (min)">
          <input type="number" value={data.intubationTimeMin} onChange={e => set('intubationTimeMin', e.target.value)}
            placeholder="—" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Withdrawal time (min)">
          <input type="number" value={data.withdrawalTimeMin} onChange={e => set('withdrawalTimeMin', e.target.value)}
            placeholder="≥6" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Ileoscopy">
          <ChipRow chips={['Performed — normal', 'Performed — abnormal', 'Not attempted']}
            value={[data.ileoscopy]} onToggle={v => set('ileoscopy', v)} />
        </Field>
      </div>

      <Field label="Colonic findings">
        <ChipRow chips={['Normal colon', 'Diverticulosis (mild)', 'Diverticulosis (moderate)', 'Diverticulosis (severe)', 'Diverticulitis changes', 'Angiodysplasia', 'Melanosis coli', 'Haemorrhoids (internal)', 'Active bleeding', 'Old blood', 'Mass / lesion', 'Stricture', 'Anastomotic changes', 'IBD changes']}
          value={data.findings} onToggle={c => toggleArr('findings', c)} />
      </Field>

      {/* Polyp table */}
      <Field label="Polyps">
        {data.polyps.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0' }}>No polyps recorded</div>
        )}
        {data.polyps.map((polyp, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr auto', gap: 6, marginBottom: 6, background: '#f9fafb', borderRadius: 6, padding: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Site</div>
              <SelectOpts chips={['Rectum', 'Sigmoid', 'Descending colon', 'Splenic flexure', 'Transverse colon', 'Hepatic flexure', 'Ascending colon', 'Caecum', 'Terminal ileum']}
                value={polyp.site} onChange={v => updatePolyp(i, 'site', v)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Size</div>
              <input type="text" value={polyp.size} onChange={e => updatePolyp(i, 'size', e.target.value)}
                placeholder="mm" style={{ fontSize: 12, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Morphology (Paris)</div>
              <SelectOpts chips={['Ip (pedunculated)', 'Is (sessile)', 'IIa (flat elevated)', 'IIb (flat)', 'IIc (depressed)', 'LST (laterally spreading)', 'LST-G', 'LST-NG']}
                value={polyp.morphology} onChange={v => updatePolyp(i, 'morphology', v)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Intervention</div>
              <SelectOpts chips={['Biopsy only', 'Hot snare polypectomy', 'Cold snare polypectomy', 'EMR', 'ESD', 'APC', 'Clip haemostasis', 'Left in situ — refer']}
                value={polyp.intervention} onChange={v => updatePolyp(i, 'intervention', v)} />
            </div>
            <button type="button" onClick={() => removePolyp(i)}
              style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, paddingBottom: 2 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={addPolyp}
          style={{ marginTop: 4, fontSize: 12, color: '#0d9488', background: 'none', border: '1px dashed #0d9488', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
          + Add polyp
        </button>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Tattoo">
          <ChipRow chips={['Applied', 'Not required', 'Deferred']} value={[data.tattoo]} onToggle={v => set('tattoo', v)} />
        </Field>
        <Field label="Tattoo site">
          <input type="text" value={data.tattooSite} onChange={e => set('tattooSite', e.target.value)}
            placeholder="e.g. 5 cm proximal to lesion, sigmoid colon" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Complications">
        <ChipRow chips={['None', 'Post-polypectomy bleeding', 'Perforation', 'Haematoma', 'Aspiration', 'Incomplete resection', 'Poor tolerance / abandoned']}
          value={data.complications} onToggle={c => toggleArr('complications', c)} />
      </Field>

      <Field label="Additional findings / plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Additional findings, biopsy plan, surveillance interval…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── ERCP form ─────────────────────────────────────────────────────────────────

interface ErcpData {
  indication: string; sedationType: string;
  cannulation: string; contrastInjection: string;
  cholangiogramFindings: string[]; cbdDiameter: string;
  sphincterotomy: string; precut: string;
  stoneExtraction: string; stoneCount: string; stoneSizeMm: string;
  stent: string; stentType: string; stentSizeFr: string; stentLengthCm: string;
  biliarySweep: string; fluoroscopyTimeMin: string;
  complications: string[]; additionalNotes: string;
}

const EMPTY_ERCP: ErcpData = {
  indication: '', sedationType: '',
  cannulation: '', contrastInjection: '',
  cholangiogramFindings: [], cbdDiameter: '',
  sphincterotomy: '', precut: '',
  stoneExtraction: '', stoneCount: '', stoneSizeMm: '',
  stent: '', stentType: '', stentSizeFr: '', stentLengthCm: '',
  biliarySweep: '', fluoroscopyTimeMin: '',
  complications: [], additionalNotes: '',
};

function ErcpForm({ data, onChange }: { data: ErcpData; onChange: (d: ErcpData) => void }) {
  function set<K extends keyof ErcpData>(k: K, v: ErcpData[K]) { onChange({ ...data, [k]: v }); }
  function toggleArr(k: 'cholangiogramFindings' | 'complications', c: string) {
    const cur = data[k];
    set(k, cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Indication">
          <SelectOpts chips={['CBD stones (choledocholithiasis)', 'Biliary stricture (benign)', 'Biliary stricture (malignant)', 'Cholangitis', 'Biliary leak', 'Stent exchange', 'Pancreatic duct stones', 'Pancreatic stricture', 'Bile duct injury', 'PSC / cholangiopathy']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Sedation / anaesthesia">
          <ChipRow chips={['Conscious sedation', 'Propofol TIVA', 'GA', 'Monitored anaesthesia care']}
            value={[data.sedationType]} onToggle={v => set('sedationType', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Cannulation">
          <ChipRow chips={['Successful — native papilla', 'Successful — pancreatic duct', 'Failed', 'Previous sphincterotomy']}
            value={[data.cannulation]} onToggle={v => set('cannulation', v)} />
        </Field>
        <Field label="Contrast injection">
          <ChipRow chips={['Full cholangiogram', 'Partial', 'Not performed']}
            value={[data.contrastInjection]} onToggle={v => set('contrastInjection', v)} />
        </Field>
        <Field label="CBD diameter (mm)">
          <input type="number" value={data.cbdDiameter} onChange={e => set('cbdDiameter', e.target.value)}
            placeholder="mm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Cholangiogram findings">
        <ChipRow chips={['Normal biliary tree', 'CBD stones (filling defects)', 'Dilated CBD', 'Biliary stricture (proximal)', 'Biliary stricture (mid)', 'Biliary stricture (distal)', 'Biliary leak', 'Cystic duct stump leak', 'Hilar involvement', 'Pancreatic duct filling', 'Post-surgical anatomy']}
          value={data.cholangiogramFindings} onToggle={c => toggleArr('cholangiogramFindings', c)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Sphincterotomy">
          <ChipRow chips={['Performed', 'Not performed', 'Extension of prior']}
            value={[data.sphincterotomy]} onToggle={v => set('sphincterotomy', v)} />
        </Field>
        <Field label="Pre-cut sphincterotomy">
          <ChipRow chips={['Performed', 'Not required', 'Attempted — failed']}
            value={[data.precut]} onToggle={v => set('precut', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Stone extraction">
          <ChipRow chips={['Complete clearance', 'Partial — residual stones', 'Not possible', 'Not applicable']}
            value={[data.stoneExtraction]} onToggle={v => set('stoneExtraction', v)} />
        </Field>
        <Field label="Stone count">
          <input type="text" value={data.stoneCount} onChange={e => set('stoneCount', e.target.value)}
            placeholder="e.g. 3" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Stone size (mm)">
          <input type="text" value={data.stoneSizeMm} onChange={e => set('stoneSizeMm', e.target.value)}
            placeholder="e.g. 5–12" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Field label="Stent placed">
          <ChipRow chips={['Yes', 'No']} value={[data.stent]} onToggle={v => set('stent', v)} />
        </Field>
        <Field label="Stent type">
          <SelectOpts chips={['Plastic (straight)', 'Plastic (pigtail)', 'SEMS (uncovered)', 'SEMS (partially covered)', 'SEMS (fully covered)', 'Nasobiliary drain']}
            value={data.stentType} onChange={v => set('stentType', v)} />
        </Field>
        <Field label="Stent size (Fr)">
          <input type="number" value={data.stentSizeFr} onChange={e => set('stentSizeFr', e.target.value)}
            placeholder="Fr" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Stent length (cm)">
          <input type="number" value={data.stentLengthCm} onChange={e => set('stentLengthCm', e.target.value)}
            placeholder="cm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Biliary sweep / balloon">
          <ChipRow chips={['Performed — clear', 'Performed — residual', 'Not performed']}
            value={[data.biliarySweep]} onToggle={v => set('biliarySweep', v)} />
        </Field>
        <Field label="Fluoroscopy time (min)">
          <input type="number" value={data.fluoroscopyTimeMin} onChange={e => set('fluoroscopyTimeMin', e.target.value)}
            placeholder="min" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Complications">
        <ChipRow chips={['None', 'Post-ERCP pancreatitis', 'Bleeding (immediate)', 'Bleeding (delayed)', 'Perforation', 'Cholangitis', 'Cholecystitis', 'Stent migration', 'Basket impaction', 'Contrast reaction']}
          value={data.complications} onToggle={c => toggleArr('complications', c)} />
      </Field>

      <Field label="Additional findings / plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Cytology brushings, pancreatogram findings, follow-up plan…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Pre-op form ───────────────────────────────────────────────────────────────

interface PreopData {
  plannedProcedure: string; urgency: string; asaGrade: string;
  airway: string; dentition: string;
  cardiacRisk: string[]; respiratoryRisk: string[];
  bloodsOk: string; crossmatch: string; ecg: string; cxr: string; imaging: string;
  consentObtained: string; consentNotes: string;
  anaesthesiaConsent: string; lastOralIntake: string;
  prophylaxis: string[]; additionalNotes: string;
}

const EMPTY_PREOP: PreopData = {
  plannedProcedure: '', urgency: '', asaGrade: '',
  airway: '', dentition: '',
  cardiacRisk: [], respiratoryRisk: [],
  bloodsOk: '', crossmatch: '', ecg: '', cxr: '', imaging: '',
  consentObtained: '', consentNotes: '',
  anaesthesiaConsent: '', lastOralIntake: '',
  prophylaxis: [], additionalNotes: '',
};

function PreopForm({ data, onChange }: { data: PreopData; onChange: (d: PreopData) => void }) {
  function set<K extends keyof PreopData>(k: K, v: PreopData[K]) { onChange({ ...data, [k]: v }); }
  function toggleArr(k: 'cardiacRisk' | 'respiratoryRisk' | 'prophylaxis', c: string) {
    const cur = data[k];
    set(k, cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Planned procedure">
          <input type="text" value={data.plannedProcedure} onChange={e => set('plannedProcedure', e.target.value)}
            placeholder="e.g. Laparoscopic cholecystectomy" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Urgency">
          <ChipRow chips={['Elective', 'Urgent (24–72 h)', 'Emergency (<24 h)', 'Semi-elective']}
            value={[data.urgency]} onToggle={v => set('urgency', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="ASA grade">
          <ChipRow chips={['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V', 'ASA VI']}
            value={[data.asaGrade]} onToggle={v => set('asaGrade', v)} />
        </Field>
        <Field label="Airway assessment">
          <ChipRow chips={['Mallampati I', 'Mallampati II', 'Mallampati III', 'Mallampati IV', 'Difficult airway predicted', 'Previous difficult intubation']}
            value={[data.airway]} onToggle={v => set('airway', v)} />
        </Field>
        <Field label="Dentition">
          <ChipRow chips={['Good / intact', 'Loose teeth', 'Dentures / plates', 'Poor dentition']}
            value={[data.dentition]} onToggle={v => set('dentition', v)} />
        </Field>
      </div>

      <Field label="Cardiac risk factors">
        <ChipRow chips={['None identified', 'Hypertension', 'IHD / angina', 'Prior MI', 'CCF', 'Arrhythmia', 'Pacemaker / ICD', 'Valvular disease', 'Poor exercise tolerance (<4 METs)']}
          value={data.cardiacRisk} onToggle={c => toggleArr('cardiacRisk', c)} />
      </Field>

      <Field label="Respiratory risk factors">
        <ChipRow chips={['None identified', 'Asthma', 'COPD', 'OSA / CPAP', 'Pulmonary hypertension', 'Active respiratory infection', 'Smoker (active)']}
          value={data.respiratoryRisk} onToggle={c => toggleArr('respiratoryRisk', c)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {([['bloodsOk', 'Bloods checked'], ['crossmatch', 'X-match / G&S'], ['ecg', 'ECG'], ['cxr', 'CXR'], ['imaging', 'Imaging reviewed']] as [keyof PreopData, string][]).map(([k, lbl]) => (
          <Field key={k} label={lbl}>
            <ChipRow chips={['Done ✓', 'N/A', 'Pending']}
              value={[data[k] as string]} onToggle={v => set(k, v)} />
          </Field>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Surgical consent">
          <ChipRow chips={['Obtained — signed', 'Verbal (emergency)', 'Pending', 'Not applicable']}
            value={[data.consentObtained]} onToggle={v => set('consentObtained', v)} />
        </Field>
        <Field label="Anaesthesia consent">
          <ChipRow chips={['Obtained', 'Pending', 'N/A']}
            value={[data.anaesthesiaConsent]} onToggle={v => set('anaesthesiaConsent', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Consent notes (risks discussed)">
          <input type="text" value={data.consentNotes} onChange={e => set('consentNotes', e.target.value)}
            placeholder="e.g. Bleeding, infection, conversion to open, bile leak discussed" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Last oral intake (time)">
          <input type="text" value={data.lastOralIntake} onChange={e => set('lastOralIntake', e.target.value)}
            placeholder="e.g. Nil by mouth since 06:00" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Prophylaxis">
        <ChipRow chips={['DVT prophylaxis (LMWH)', 'TED stockings', 'Antibiotic prophylaxis', 'Aspirin held', 'Anticoagulant held / bridged', 'Metformin held', 'Bowel prep given']}
          value={data.prophylaxis} onToggle={c => toggleArr('prophylaxis', c)} />
      </Field>

      <Field label="Additional notes">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Any other pre-operative considerations…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Post-op form ──────────────────────────────────────────────────────────────

interface PostopData {
  procedurePerformed: string; approach: string; anaesthesiaType: string;
  duration: string; surgeon: string; assistant: string;
  findings: string; ebl: string; fluidIn: string; urineOut: string;
  specimenSent: string; specimenSite: string;
  drain: string; drainType: string; drainSite: string;
  closure: string; dressing: string;
  postopOrders: string[]; diet: string; ivAccess: string;
  complications: string[]; additionalNotes: string;
}

const EMPTY_POSTOP: PostopData = {
  procedurePerformed: '', approach: '', anaesthesiaType: '',
  duration: '', surgeon: '', assistant: '',
  findings: '', ebl: '', fluidIn: '', urineOut: '',
  specimenSent: '', specimenSite: '',
  drain: '', drainType: '', drainSite: '',
  closure: '', dressing: '',
  postopOrders: [], diet: '', ivAccess: '',
  complications: [], additionalNotes: '',
};

function PostopForm({ data, onChange }: { data: PostopData; onChange: (d: PostopData) => void }) {
  function set<K extends keyof PostopData>(k: K, v: PostopData[K]) { onChange({ ...data, [k]: v }); }
  function toggleArr(k: 'postopOrders' | 'complications', c: string) {
    const cur = data[k];
    set(k, cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Field label="Procedure performed">
          <input type="text" value={data.procedurePerformed} onChange={e => set('procedurePerformed', e.target.value)}
            placeholder="Full operative name" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Approach">
          <ChipRow chips={['Laparoscopic', 'Open', 'Converted to open', 'VATS', 'Robotic', 'Endoscopic']}
            value={[data.approach]} onToggle={v => set('approach', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Anaesthesia">
          <ChipRow chips={['GA', 'Spinal', 'Epidural', 'Regional block', 'MAC / sedation', 'Local only']}
            value={[data.anaesthesiaType]} onToggle={v => set('anaesthesiaType', v)} />
        </Field>
        <Field label="Duration (minutes)">
          <input type="number" value={data.duration} onChange={e => set('duration', e.target.value)}
            placeholder="min" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Surgeon">
          <input type="text" value={data.surgeon} onChange={e => set('surgeon', e.target.value)}
            placeholder="Dr Kabiye" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Intraoperative findings">
        <textarea value={data.findings} onChange={e => set('findings', e.target.value)}
          placeholder="Describe key intraoperative findings (e.g. distended gallbladder, multiple stones, no CBD dilation observed)…"
          style={{ fontSize: 12, minHeight: 70 }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="EBL (mL)">
          <input type="text" value={data.ebl} onChange={e => set('ebl', e.target.value)}
            placeholder="e.g. Minimal / 200" style={{ fontSize: 12 }} />
        </Field>
        <Field label="IV fluid in (mL)">
          <input type="text" value={data.fluidIn} onChange={e => set('fluidIn', e.target.value)}
            placeholder="e.g. 1000 NaCl" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Urine output (mL)">
          <input type="text" value={data.urineOut} onChange={e => set('urineOut', e.target.value)}
            placeholder="mL" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Specimen sent">
          <ChipRow chips={['Yes — histopathology', 'Yes — microbiology', 'Yes — cytology', 'None']}
            value={[data.specimenSent]} onToggle={v => set('specimenSent', v)} />
        </Field>
        <Field label="Specimen site / label">
          <input type="text" value={data.specimenSite} onChange={e => set('specimenSite', e.target.value)}
            placeholder="e.g. Gallbladder + contents" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Drain">
          <ChipRow chips={['Placed', 'Not placed', 'Removed intra-op']}
            value={[data.drain]} onToggle={v => set('drain', v)} />
        </Field>
        <Field label="Drain type">
          <SelectOpts chips={['Corrugated', 'Jackson-Pratt (JP)', 'Blake drain', 'T-tube', 'Chest drain', 'Pelvic drain', 'Nasobiliary']}
            value={data.drainType} onChange={v => set('drainType', v)} />
        </Field>
        <Field label="Drain site">
          <input type="text" value={data.drainSite} onChange={e => set('drainSite', e.target.value)}
            placeholder="e.g. RUQ through port site" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Wound closure">
          <ChipRow chips={['Vicryl + skin staples', 'Monocryl (subcuticular)', 'Prolene (interrupted)', 'Clips', 'Glue', 'Wound left open', 'VAC dressing']}
            value={[data.closure]} onToggle={v => set('closure', v)} />
        </Field>
        <Field label="Dressing">
          <input type="text" value={data.dressing} onChange={e => set('dressing', e.target.value)}
            placeholder="e.g. Mepilex / Tegaderm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Post-op orders">
        <ChipRow chips={['NPO until tolerated', 'Fluids only × 24h', 'Soft diet', 'Antibiotic therapy', 'Analgesia PCA', 'DVT prophylaxis', 'Foley catheter', 'NG tube', 'IDC — strict I&O', 'Continuous monitoring', 'Nurse-led observations Q4H', 'Physiotherapy', 'Wound review in 2 days']}
          value={data.postopOrders} onToggle={c => toggleArr('postopOrders', c)} />
      </Field>

      <Field label="Complications (intra-op)">
        <ChipRow chips={['None', 'Haemorrhage', 'Bowel injury', 'Bile duct injury', 'Urinary tract injury', 'Vascular injury', 'Conversion to open', 'Prolonged adhesiolysis', 'Anaesthetic complication']}
          value={data.complications} onToggle={c => toggleArr('complications', c)} />
      </Field>

      <Field label="Additional operative notes">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Any other intraoperative or post-op details…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Procedure PDF export ──────────────────────────────────────────────────────

function buildProcHtml(type: ProcType, ogd: OgdData, colon: ColonData, ercp: ErcpData, preop: PreopData, postop: PostopData, freeText: string, patientName: string): string {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const row = (label: string, val: string | string[]) => {
    const v = Array.isArray(val) ? val.join(', ') : val;
    if (!v) return '';
    return `<tr><td style="padding:4px 10px 4px 0;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0 4px 10px;color:#111">${v}</td></tr>`;
  };
  const section = (title: string, rows: string) =>
    `<h3 style="margin:16px 0 6px;font-size:13px;color:#0d9488;border-bottom:1px solid #d1fae5;padding-bottom:4px">${title}</h3><table style="border-collapse:collapse;width:100%;font-size:12px">${rows}</table>`;

  let body = '';
  if (type === 'ogd') {
    body = section('Upper GI Endoscopy (OGD)', [
      row('Indication', ogd.indication),
      row('Sedation', ogd.sedationType),
      row('Oesophagus', ogd.oesophagus),
      row('Z-line / GEJ', ogd.zLine),
      row('Stomach', ogd.stomach),
      row('Hiatal hernia', ogd.hiatalHernia),
      row('Duodenum', ogd.duodenum),
      row('Biopsy taken', ogd.biopsy),
      row('Biopsy site', ogd.biopsySite),
      row('CLO test', ogd.cloTest),
      row('H. pylori', ogd.hpylori),
      row('Complications', ogd.complications),
      row('Notes', ogd.additionalNotes),
    ].join(''));
  } else if (type === 'colonoscopy') {
    body = section('Colonoscopy', [
      row('Indication', colon.indication),
      row('Bowel prep quality', colon.prepQuality),
      row('Cecal intubation', colon.cecalIntubation),
      row('Intubation time', colon.intubationTimeMin ? `${colon.intubationTimeMin} min` : ''),
      row('Withdrawal time', colon.withdrawalTimeMin ? `${colon.withdrawalTimeMin} min` : ''),
      row('Findings', colon.findings),
      row('Polyps', colon.polyps.length ? colon.polyps.map(p => `${p.site} — ${p.size}mm, ${p.morphology}, ${p.intervention}`).join('; ') : ''),
      row('Tattoo placed', colon.tattoo),
      row('Complications', colon.complications),
      row('Notes', colon.additionalNotes),
    ].join(''));
  } else if (type === 'ercp') {
    body = section('ERCP', [
      row('Indication', ercp.indication),
      row('Cannulation', ercp.cannulation),
      row('Contrast injection', ercp.contrastInjection),
      row('CBD diameter', ercp.cbdDiameter ? `${ercp.cbdDiameter} mm` : ''),
      row('Cholangiogram findings', ercp.cholangiogramFindings),
      row('Sphincterotomy', ercp.sphincterotomy),
      row('Stone extraction', ercp.stoneExtraction && ercp.stoneExtraction !== 'Not applicable' ? `${ercp.stoneCount || ''} stone(s), max ${ercp.stoneSizeMm || ''}mm — ${ercp.stoneExtraction}` : ercp.stoneExtraction),
      row('Stent', ercp.stent === 'Yes' ? `${ercp.stentType} ${ercp.stentSizeFr}Fr ${ercp.stentLengthCm}cm` : ercp.stent),
      row('Biliary sweep', ercp.biliarySweep),
      row('Fluoroscopy time', ercp.fluoroscopyTimeMin ? `${ercp.fluoroscopyTimeMin} min` : ''),
      row('Complications', ercp.complications),
      row('Notes', ercp.additionalNotes),
    ].join(''));
  } else if (type === 'preop') {
    body = section('Pre-operative Assessment', [
      row('Planned procedure', preop.plannedProcedure),
      row('Urgency', preop.urgency),
      row('ASA grade', preop.asaGrade),
      row('Airway (Mallampati)', preop.airway),
      row('Dentition', preop.dentition),
      row('Cardiac risk', preop.cardiacRisk),
      row('Respiratory risk', preop.respiratoryRisk),
      row('Investigations', [preop.bloodsOk && `Bloods: ${preop.bloodsOk}`, preop.crossmatch && `X-match: ${preop.crossmatch}`, preop.ecg && `ECG: ${preop.ecg}`, preop.cxr && `CXR: ${preop.cxr}`, preop.imaging && `Imaging: ${preop.imaging}`].filter(Boolean).join(', ')),
      row('Consent obtained', preop.consentObtained),
      row('Consent notes', preop.consentNotes),
      row('Prophylaxis', preop.prophylaxis),
      row('Notes', preop.additionalNotes),
    ].join(''));
  } else if (type === 'postop') {
    body = section('Post-operative Note', [
      row('Procedure performed', postop.procedurePerformed),
      row('Approach', postop.approach),
      row('Anaesthesia', postop.anaesthesiaType),
      row('Duration', postop.duration ? `${postop.duration} min` : ''),
      row('Surgeon', postop.surgeon),
      row('Intraoperative findings', postop.findings),
      row('EBL', postop.ebl ? `${postop.ebl} mL` : ''),
      row('Fluid in', postop.fluidIn ? `${postop.fluidIn} mL` : ''),
      row('Urine out', postop.urineOut ? `${postop.urineOut} mL` : ''),
      row('Specimen', postop.specimenSent + (postop.specimenSite ? ` — ${postop.specimenSite}` : '')),
      row('Drain', postop.drain + (postop.drainType ? ` (${postop.drainType})` : '') + (postop.drainSite ? `, ${postop.drainSite}` : '')),
      row('Wound closure', postop.closure),
      row('Dressing', postop.dressing),
      row('Post-op orders', postop.postopOrders),
      row('Complications', postop.complications),
      row('Notes', postop.additionalNotes),
    ].join(''));
  } else {
    body = `<p style="font-size:13px;white-space:pre-wrap">${freeText.replace(/</g, '&lt;')}</p>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Procedure Note</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:32px auto;color:#111;font-size:13px}
h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;color:#6b7280;font-weight:400;margin:0 0 16px}
@media print{body{margin:16px}}</style></head><body>
<h1>Procedure Note — ${type.toUpperCase()}</h1>
<h2>${patientName} &nbsp;|&nbsp; ${now}</h2>
${body}
<p style="margin-top:32px;font-size:10px;color:#9ca3af">Amise Medical Services · Dr Dawit Daniel Kabiye MD DM · Printed ${now}</p>
</body></html>`;
}

function printProcNote(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 400);
}

// ── Main component ────────────────────────────────────────────────────────────

const PROC_TABS: { id: ProcType; label: string }[] = [
  { id: 'ogd',        label: 'OGD' },
  { id: 'colonoscopy', label: 'Colonoscopy' },
  { id: 'ercp',       label: 'ERCP' },
  { id: 'preop',      label: 'Pre-op Assessment' },
  { id: 'postop',     label: 'Post-op Note' },
  { id: 'other',      label: 'Other / Notes' },
];

export default function ProceduresTab() {
  const { procedureData, setProcedureData, procedures, setProcedures, patientName } = useAppContext();
  const [activeType, setActiveType] = useState<ProcType>('ogd');

  function getTyped<T>(key: string, empty: T): T {
    return (procedureData[key] as T | undefined) ?? empty;
  }
  function setTyped<T>(key: string, val: T) {
    setProcedureData({ ...procedureData, [key]: val });
  }

  const ogd    = getTyped<OgdData>('ogd', EMPTY_OGD);
  const colon  = getTyped<ColonData>('colonoscopy', EMPTY_COLON);
  const ercp   = getTyped<ErcpData>('ercp', EMPTY_ERCP);
  const preop  = getTyped<PreopData>('preop', EMPTY_PREOP);
  const postop = getTyped<PostopData>('postop', EMPTY_POSTOP);

  return (
    <div className="gap-y">
      {/* Procedure type selector + print button */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PROC_TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveType(tab.id)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: activeType === tab.id ? 700 : 500,
              border: activeType === tab.id ? '2px solid #0d9488' : '1px solid #d1d5db',
              background: activeType === tab.id ? '#0d9488' : '#fff',
              color: activeType === tab.id ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => printProcNote(buildProcHtml(activeType, ogd, colon, ercp, preop, postop, procedures, patientName || 'Patient'))}
          style={{
            marginLeft: 'auto',
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: '1px solid #0d9488', background: '#fff', color: '#0d9488', cursor: 'pointer',
          }}
        >
          Print / Export PDF
        </button>
      </div>

      {activeType === 'ogd' && (
        <CollapsibleCard title="Upper GI Endoscopy (OGD) Report">
          <OgdForm data={ogd} onChange={d => setTyped('ogd', d)} />
        </CollapsibleCard>
      )}

      {activeType === 'colonoscopy' && (
        <CollapsibleCard title="Colonoscopy Report">
          <ColonForm data={colon} onChange={d => setTyped('colonoscopy', d)} />
        </CollapsibleCard>
      )}

      {activeType === 'ercp' && (
        <CollapsibleCard title="ERCP Report">
          <ErcpForm data={ercp} onChange={d => setTyped('ercp', d)} />
        </CollapsibleCard>
      )}

      {activeType === 'preop' && (
        <CollapsibleCard title="Pre-operative Assessment">
          <PreopForm data={preop} onChange={d => setTyped('preop', d)} />
        </CollapsibleCard>
      )}

      {activeType === 'postop' && (
        <CollapsibleCard title="Post-operative Note">
          <PostopForm data={postop} onChange={d => setTyped('postop', d)} />
        </CollapsibleCard>
      )}

      {activeType === 'other' && (
        <CollapsibleCard title="Procedure Notes / Other">
          <div className="fld">
            <label>Free-text procedure notes</label>
            <textarea
              value={procedures}
              onChange={e => setProcedures(e.target.value)}
              placeholder="Any other procedure notes — consent, operator grade, planned procedures, complications…"
              style={{ minHeight: 160, fontSize: 13 }}
            />
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
