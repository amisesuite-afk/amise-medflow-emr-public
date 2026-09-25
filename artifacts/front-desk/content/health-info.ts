/**
 * Health-information library — patient-education articles for the public
 * website (/health-information).
 *
 * CONTENT GOVERNANCE (read before editing)
 * ─────────────────────────────────────────
 * - Only articles with `status: 'approved'` are published. Drafts 404 on the
 *   public site and are left out of the sitemap; staff can preview every
 *   article at /staff/health-information.
 * - Approval is Dr Kabiye's decision. When he approves an article, set in this
 *   file: status 'approved', lastReviewed (YYYY-MM-DD), reviewedBy (name and
 *   role), reviewDue (normally lastReviewed + 12 months) and version '1.0.0'.
 *   Never put a date in lastReviewed without a real review by a named reviewer.
 * - Any wording change to an approved article: bump its version, set it back
 *   to 'draft' (or record a fresh review), and bump
 *   HEALTH_INFO_LIBRARY_VERSION together with the entry
 *   `front-desk-health-information` in clinical-content/registry.json (add a
 *   changelog line). Workflow: docs/CLINICAL-CONTENT-UPGRADES.md §9.
 * - Text rules (CI: lint:patient-instructions, hazard H-10, CLAUDE.md Tone):
 *   general information only, no personal advice, no medicine names with
 *   doses, never tell a reader to take, hold, stop or adjust a medicine
 *   (the approved line is "If you take … please call the clinic … for
 *   instructions"), no fasting-from-midnight wording, no fees, no invented
 *   statistics. Cite a guideline only where the name and year are certain.
 * - Governance checks (CI: lint:guideline-registry and front-desk vitest):
 *   an approved article must have lastReviewed, reviewedBy, reviewDue and at
 *   least one source; one past reviewDue is warned about.
 */

export type ArticleStatus = 'draft' | 'approved';

export interface ArticleSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface ArticleSource {
  /** Guideline or organisation, as it would be cited. */
  name: string;
  /** Year of the edition cited. */
  year: string;
  /** Only for well-known, stable addresses. */
  url?: string;
}

export interface HealthArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sections: ArticleSection[];
  whenToSeekUrgentCare: {
    /** Always SEEK_URGENT_CARE: 911 and the three emergency departments. */
    intro: string;
    signs: string[];
  };
  sources: ArticleSource[];
  status: ArticleStatus;
  /** YYYY-MM-DD of the documented clinical review, or null. */
  lastReviewed: string | null;
  /** Name and role of the reviewer, e.g. "Dr Dawit Daniel Kabiye, MD, DM". */
  reviewedBy: string | null;
  /** YYYY-MM-DD by which the article must be reviewed again, or null. */
  reviewDue: string | null;
  /** Semantic version of this article's wording (drafts 0.x, approved ≥ 1.0.0). */
  version: string;
}

/** Library version — bump with any article change; mirrored in clinical-content/registry.json. */
export const HEALTH_INFO_LIBRARY_VERSION = '0.1.0';

/** Shown on every article and on the index page. */
export const GENERAL_INFORMATION_NOTICE =
  'This is general information, not medical advice. Everyone is different — please speak to your doctor about your own situation before making any decision about your health or treatment.';

/** The emergency departments to name. (Victoria Hospital no longer exists.) */
export const EMERGENCY_DEPARTMENTS = "OKEU Hospital, St Jude's Hospital or Tapion Hospital";

export const SEEK_URGENT_CARE =
  `Call 911 or go to the nearest emergency department — ${EMERGENCY_DEPARTMENTS} — if you notice any of the following. Do not wait for a clinic appointment, and do not use this website, email or WhatsApp to report an emergency.`;

/** The approved medicines line (same wording as the booking instructions). */
const MEDICINES_CALL_THE_CLINIC =
  'If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions.';

const DRAFT = {
  status: 'draft',
  lastReviewed: null,
  reviewedBy: null,
  reviewDue: null,
  version: '0.1.0',
} as const;

// ── Articles ──────────────────────────────────────────────────────────────────

export const HEALTH_ARTICLES: HealthArticle[] = [
  // 1 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gallstones',
    slug: 'gallstones-and-gallbladder-surgery',
    title: 'Gallstones and gallbladder surgery',
    summary:
      'What gallstones are, the symptoms they can cause, how they are found, and what to expect if keyhole removal of the gallbladder is recommended.',
    sections: [
      {
        heading: 'What are gallstones?',
        paragraphs: [
          'The gallbladder is a small pouch that sits under the liver. It stores bile, a fluid made by the liver that helps with the digestion of fatty food. Gallstones are small, hard deposits that form inside the gallbladder.',
          'Gallstones are common, and many people who have them never have any symptoms. Stones found by chance on a scan, and causing no symptoms, usually do not need treatment.',
        ],
      },
      {
        heading: 'Symptoms',
        bullets: [
          'Pain in the upper right or upper middle part of the abdomen, often after a meal. It may spread to the back or the right shoulder and can last from several minutes to a few hours. This is sometimes called "biliary colic".',
          'Feeling sick or vomiting with the pain.',
          'Bloating and indigestion are common, but on their own they are less likely to be caused by gallstones.',
        ],
      },
      {
        heading: 'Possible complications',
        paragraphs: ['Sometimes a gallstone causes a more serious problem, such as:'],
        bullets: [
          'Inflammation of the gallbladder (cholecystitis): constant pain, tenderness and often a fever.',
          'A stone moving into the bile duct and blocking it: yellowing of the skin or eyes (jaundice), dark urine and pale stools.',
          'Infection of the bile duct (cholangitis): pain, fever, shivering and jaundice. This is serious and needs urgent treatment.',
          'Inflammation of the pancreas (pancreatitis): severe pain in the upper abdomen, often spreading to the back.',
        ],
      },
      {
        heading: 'How gallstones are diagnosed',
        paragraphs: [
          'An ultrasound scan of the abdomen is usually the first test. Blood tests check the liver and look for signs of inflammation. If a stone may be in the bile duct, another scan such as an MRCP (a type of MRI scan) may be arranged, and sometimes an ERCP to remove the stone.',
        ],
      },
      {
        heading: 'Treatment',
        paragraphs: [
          'For people whose gallstones are causing symptoms, international guidance recommends offering removal of the gallbladder by keyhole (laparoscopic) surgery. When the gallbladder is inflamed, an operation early in the illness is generally preferred to waiting.',
          'Changes to your diet may ease symptoms for some people, but they do not dissolve the stones and the pain often returns. Your surgeon will talk through the options with you, including the option of not having an operation.',
        ],
      },
      {
        heading: 'About keyhole gallbladder removal',
        bullets: [
          'The operation is done under a general anaesthetic, so you are asleep throughout.',
          'The surgeon works through a few small cuts in the abdomen using a camera and fine instruments.',
          'Many people go home the same day or the next day.',
          'Occasionally the surgeon needs to change to a larger, open cut to complete the operation safely.',
          'You can live normally without a gallbladder: bile then flows straight from the liver into the bowel. Some people notice looser stools for a while afterwards.',
        ],
      },
      {
        heading: 'Risks',
        paragraphs: [
          'As with any operation there are risks, including bleeding, wound infection, a bile leak, blood clots and the risks of the anaesthetic. Injury to the main bile duct is uncommon but serious. Your surgeon will explain the risks that apply to you before you decide.',
        ],
      },
      {
        heading: 'Recovery',
        paragraphs: [
          'Getting up and walking soon after the operation helps recovery. Most people return to light activities within one to two weeks. The team will advise you about lifting, returning to work and driving. You should only drive when you can make an emergency stop comfortably, and it is sensible to check with your insurer.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Severe pain in the abdomen that lasts more than a few hours or keeps getting worse.',
        'Fever, shivering or feeling very unwell with abdominal pain.',
        'Yellowing of the skin or the whites of the eyes, especially with pain or fever.',
        'Vomiting that will not settle.',
        'After gallbladder surgery: increasing abdominal pain or swelling, a fever, or yellowing of the skin or eyes.',
      ],
    },
    sources: [
      { name: 'NICE CG188: Gallstone disease — diagnosis and management', year: '2014', url: 'https://www.nice.org.uk/guidance/cg188' },
      { name: 'Tokyo Guidelines 2018 (TG18) for acute cholangitis and cholecystitis, Journal of Hepato-Biliary-Pancreatic Sciences', year: '2018' },
      { name: 'World Society of Emergency Surgery (WSES) guidelines on acute calculous cholecystitis, World Journal of Emergency Surgery', year: '2020' },
    ],
    ...DRAFT,
  },

  // 2 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'hernias',
    slug: 'hernias',
    title: 'Hernias: groin, umbilical and incisional',
    summary:
      'What a hernia is, the different types, when an operation is recommended, and the warning signs of a hernia that needs emergency care.',
    sections: [
      {
        heading: 'What is a hernia?',
        paragraphs: [
          'A hernia is a bulge that appears where fat or part of the bowel pushes through a weak area in the muscle wall of the abdomen. Hernias do not heal on their own, but many cause few problems for a long time.',
        ],
        bullets: [
          'Inguinal hernia: in the groin. The most common type, especially in men.',
          'Femoral hernia: low in the groin or at the top of the thigh. More common in women.',
          'Umbilical and paraumbilical hernia: at or near the belly button.',
          'Epigastric hernia: in the midline between the belly button and the breastbone.',
          'Incisional hernia: through the scar of a previous operation.',
        ],
      },
      {
        heading: 'Symptoms',
        bullets: [
          'A lump that may appear when you stand, cough, strain or lift, and may disappear when you lie down.',
          'An ache or dragging feeling, often worse at the end of the day.',
          'Some hernias cause no symptoms at all and are found at a routine examination.',
        ],
      },
      {
        heading: 'Does every hernia need an operation?',
        paragraphs: [
          'Not always. For men with a groin (inguinal) hernia that causes few or no symptoms, international guidance says that careful "watchful waiting" is a reasonable choice after discussion with a surgeon. Many people later choose an operation as symptoms increase.',
          'Femoral hernias are more likely to become trapped, so an operation is usually recommended soon after one is found.',
          'For umbilical and other abdominal wall hernias, the decision depends on the size, your symptoms and your general health. Your surgeon will explain the benefits and risks of an operation and of waiting.',
        ],
      },
      {
        heading: 'How hernias are repaired',
        bullets: [
          'The repair may be open (through one cut over the hernia) or keyhole (laparoscopic), depending on the type of hernia and your health.',
          'Most repairs use a mesh to strengthen the weak area and lower the chance of the hernia coming back.',
          'Many hernia repairs are done as day surgery, under a general, regional or local anaesthetic.',
        ],
      },
      {
        heading: 'Things that help',
        bullets: [
          'Reaching and keeping a healthy weight.',
          'Stopping smoking, which helps healing and lowers the chance of a hernia returning after repair.',
          'Speaking to your doctor about a cough that will not go away or long-standing constipation, as straining puts pressure on a hernia.',
          'A support garment (truss) can ease discomfort for some people, but it does not cure a hernia. Please discuss it with your surgeon first.',
        ],
      },
      {
        heading: 'Recovery after repair',
        paragraphs: [
          'Walking and light activity can usually start straight away. The team will advise you about lifting, exercise, driving and returning to work, which depend on the type of repair and your job.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'A hernia that suddenly becomes very painful, tender or hard.',
        'A hernia that you can normally push back in but now cannot.',
        'The skin over the hernia turning red, purple or dark.',
        'Vomiting, a swollen abdomen, or being unable to pass wind or open your bowels, together with a hernia.',
      ],
    },
    sources: [
      { name: 'HerniaSurge Group: International guidelines for groin hernia management, Hernia', year: '2018' },
      { name: 'European Hernia Society and Americas Hernia Society guidelines on the treatment of primary umbilical and epigastric hernias, British Journal of Surgery', year: '2020' },
    ],
    ...DRAFT,
  },

  // 3 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'colonoscopy-screening',
    slug: 'colonoscopy-and-bowel-cancer-screening',
    title: 'Colonoscopy and bowel cancer screening',
    summary:
      'Why bowel cancer screening matters, who it is for, the main screening tests, and what happens before, during and after a colonoscopy.',
    sections: [
      {
        heading: 'Why screening matters',
        paragraphs: [
          'Most bowel (colorectal) cancers grow slowly from small growths called polyps. Screening can find polyps, which can often be removed before they ever become cancer, and can find cancers at an early stage, when treatment works best. Early bowel cancer often causes no symptoms, which is why screening is offered to people who feel well.',
        ],
      },
      {
        heading: 'Who should be screened?',
        paragraphs: [
          'The US Preventive Services Task Force (2021) recommends screening for adults aged 45 to 75 who are at average risk. For people aged 76 to 85, the decision is made individually with their doctor.',
          'You may need screening earlier or more often if you have a close relative who had bowel cancer or advanced polyps, if you have had polyps yourself, if you have inflammatory bowel disease (Crohn\'s disease or ulcerative colitis), or if an inherited condition runs in your family. Please ask your doctor what applies to you.',
        ],
      },
      {
        heading: 'Screening tests',
        bullets: [
          'Stool test (FIT): a simple test you do at home on a small sample of stool, looking for hidden blood. It is repeated regularly, and a positive result is followed by a colonoscopy.',
          'Colonoscopy: a direct look at the whole of the large bowel. Polyps can be removed during the same test. If it is normal and you are at average risk, it is usually not repeated for several years.',
          'Other tests exist. Your doctor can explain which suits you best.',
        ],
      },
      {
        heading: 'What is a colonoscopy?',
        paragraphs: [
          'A thin, flexible tube with a camera is passed through the back passage and around the large bowel. The doctor can take small samples (biopsies) and remove polyps, which is not painful. The test itself usually takes less than an hour, although you will be at the unit for longer. You will usually be offered sedation to help you relax.',
        ],
      },
      {
        heading: 'Getting ready',
        bullets: [
          'The bowel needs to be completely clear so that the doctor can see properly. The clinic will give you a bowel preparation with written instructions, including what you can eat and drink and when. Following them closely makes the test more accurate.',
          MEDICINES_CALL_THE_CLINIC,
          'Bring a list of all your medicines to the appointment.',
          'If you have sedation, a responsible adult must take you home. You should not drive, drink alcohol, operate machinery or sign important documents for 24 hours afterwards.',
        ],
      },
      {
        heading: 'Afterwards',
        paragraphs: [
          'Some bloating and wind are normal for a few hours. The doctor will tell you what was seen before you leave. Results from any samples take longer, and the clinic will arrange to discuss them with you and plan any follow-up.',
        ],
      },
      {
        heading: 'Risks',
        paragraphs: [
          'Colonoscopy is a common and generally safe test. Possible problems include bleeding (more likely after a polyp is removed), a tear in the bowel wall (perforation), which is rare, and reactions to sedation. Occasionally a polyp can be missed. The doctor will explain these before you agree to the test.',
        ],
      },
      {
        heading: 'Symptoms should not wait for screening',
        paragraphs: ['Screening is for people without symptoms. Please book an appointment rather than waiting for a screening test if you have:'],
        bullets: [
          'Bleeding from the back passage or blood in your stools.',
          'A change in your bowel habit that lasts several weeks.',
          'Weight loss you cannot explain, or ongoing tiredness.',
          'Pain or a lump in the abdomen that does not go away.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Heavy bleeding from the back passage, or passing clots.',
        'Black, tarry stools, especially with dizziness or fainting.',
        'Severe abdominal pain, or a swollen, hard abdomen — particularly after a colonoscopy.',
        'Fever or feeling very unwell after a colonoscopy.',
      ],
    },
    sources: [
      { name: 'US Preventive Services Task Force: Colorectal cancer screening recommendation', year: '2021', url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening' },
      { name: 'American Cancer Society guideline for colorectal cancer screening for average-risk adults, CA: A Cancer Journal for Clinicians', year: '2018' },
      { name: 'BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines, Gut', year: '2020' },
      { name: 'European Society of Gastrointestinal Endoscopy (ESGE) guideline on bowel preparation for colonoscopy, Endoscopy', year: '2019' },
    ],
    ...DRAFT,
  },

  // 4 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'haemorrhoids-fissure',
    slug: 'haemorrhoids-and-anal-fissure',
    title: 'Haemorrhoids (piles) and anal fissure',
    summary:
      'Two common causes of bleeding and discomfort from the back passage: what they are, what helps, the treatments available, and why bleeding should always be checked.',
    sections: [
      {
        heading: 'Haemorrhoids (piles)',
        paragraphs: [
          'Haemorrhoids are swollen blood vessels in and around the back passage (anus). They are very common. Straining on the toilet, constipation, pregnancy, heavy lifting and sitting on the toilet for long periods can all contribute.',
        ],
        bullets: [
          'Bright red blood on the toilet paper or in the pan after opening your bowels.',
          'A soft lump at or inside the anus, which may come out when you open your bowels.',
          'Itching, discomfort or a feeling that the bowel has not fully emptied.',
          'A sudden, very painful, hard bluish lump at the anus can be a clotted (thrombosed) haemorrhoid.',
        ],
      },
      {
        heading: 'Anal fissure',
        paragraphs: [
          'An anal fissure is a small tear in the lining of the anus, often after passing a hard stool. It typically causes a sharp pain while opening the bowels, sometimes followed by a burning ache that can last for hours, and a small amount of bright red blood. Many fissures heal within a few weeks once stools are softer. A fissure that has not healed after several weeks is called chronic.',
        ],
      },
      {
        heading: 'Bleeding should always be checked',
        paragraphs: [
          'Other conditions, including bowel cancer, can also cause bleeding from the back passage. Please see a doctor about any bleeding, and do not assume it is "just piles" — particularly if you are older, the blood is dark or mixed with the stool, or you also have a change in bowel habit, weight loss or tiredness. An examination, and sometimes a camera test of the bowel, may be recommended.',
        ],
      },
      {
        heading: 'Things that help both conditions',
        bullets: [
          'Eating more fibre: fruit, vegetables, peas and beans, wholegrains, and local provisions such as breadfruit, dasheen and green fig.',
          'Drinking enough water through the day.',
          'Not straining, and not sitting on the toilet for long periods (for example, with a phone).',
          'Going to the toilet when you first feel the urge.',
          'A warm, shallow bath can soothe the pain of a fissure.',
        ],
      },
      {
        heading: 'Treatments',
        paragraphs: [
          'Haemorrhoids: creams and suppositories can ease symptoms; a pharmacist or doctor can advise you. If symptoms continue, treatments in the clinic include rubber band ligation (a small band placed at the base of the haemorrhoid so that it shrinks). Larger or troublesome haemorrhoids may need an operation.',
          'Anal fissure: a doctor may prescribe an ointment that relaxes the muscle around the anus and helps the tear heal. If a fissure does not heal, the options include an injection to relax the muscle or a small operation. Your surgeon will explain the benefits and risks of each, including any effect on bowel control.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Heavy bleeding from the back passage that does not stop, or passing large clots.',
        'Bleeding with dizziness, fainting or shortness of breath.',
        'Black, tarry stools.',
        'Severe pain with a fever, or a hot, red, painful swelling near the back passage.',
      ],
    },
    sources: [
      { name: 'American Society of Colon and Rectal Surgeons (ASCRS) clinical practice guidelines for the management of hemorrhoids, Diseases of the Colon & Rectum', year: '2018' },
      { name: 'American Society of Colon and Rectal Surgeons (ASCRS) clinical practice guidelines for the management of anal fissures, Diseases of the Colon & Rectum', year: '2023' },
      { name: 'NICE NG12: Suspected cancer — recognition and referral', year: '2015', url: 'https://www.nice.org.uk/guidance/ng12' },
    ],
    ...DRAFT,
  },

  // 5 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'reflux-h-pylori',
    slug: 'reflux-heartburn-and-h-pylori',
    title: 'Reflux, heartburn and H. pylori',
    summary:
      'What causes reflux and heartburn, everyday changes that help, when a gastroscopy is needed, and how the stomach infection H. pylori is tested for and treated.',
    sections: [
      {
        heading: 'Reflux and heartburn',
        paragraphs: [
          'Reflux happens when stomach acid flows back up into the gullet (oesophagus). It can cause a burning feeling behind the breastbone (heartburn), a sour taste, bringing food back up, a cough or a hoarse voice. When it happens often, it is called gastro-oesophageal reflux disease (GORD).',
        ],
      },
      {
        heading: 'Everyday changes that often help',
        bullets: [
          'Reaching a healthy weight, if you are overweight.',
          'Eating smaller meals, and leaving two to three hours between your last meal and lying down.',
          'Raising the head of the bed.',
          'Stopping smoking and cutting down on alcohol.',
          'Noticing whether particular foods or drinks bring on symptoms for you — for example fatty or spicy food, coffee or chocolate.',
        ],
        paragraphs: [
          'Antacids and acid-reducing medicines are widely used. A pharmacist or your doctor can advise which is suitable for you and for how long. Questions about your medicines are best answered by them.',
        ],
      },
      {
        heading: 'When is a gastroscopy needed?',
        paragraphs: [
          'A gastroscopy is a test in which a thin, flexible camera is passed through the mouth to look at the gullet, stomach and first part of the small bowel, and to take small samples if needed. Your doctor may recommend one if you have:',
        ],
        bullets: [
          'Difficulty swallowing, or food sticking.',
          'Vomiting that keeps coming back.',
          'Weight loss you cannot explain.',
          'Signs of bleeding, such as vomiting blood or black stools, or a low blood count (anaemia).',
          'Symptoms that continue despite treatment, or new symptoms later in life.',
        ],
      },
      {
        heading: 'H. pylori',
        paragraphs: [
          'Helicobacter pylori (H. pylori) is a common bacterium that can live in the lining of the stomach. Many people who carry it have no symptoms, but it can cause stomach and duodenal ulcers and is linked with stomach cancer. Clearing it lowers these risks.',
          'It can be tested for with a breath test, a stool test, or samples taken during a gastroscopy. Some medicines can affect the accuracy of these tests, so the clinic will give you advice about your medicines before the test.',
          'Treatment is a short course of a combination of medicines, prescribed and explained by your doctor. A follow-up test is usually arranged afterwards to confirm that the infection has cleared.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Chest pain, especially with breathlessness, sweating, or pain spreading to the arm, neck or jaw. It may be your heart, not heartburn.',
        'Vomiting blood, or vomit that looks like coffee grounds.',
        'Black, sticky or tarry stools.',
        'Sudden, severe pain in the upper abdomen.',
        'Food stuck in the gullet so that you cannot swallow your own saliva.',
      ],
    },
    sources: [
      { name: 'NICE CG184: Gastro-oesophageal reflux disease and dyspepsia in adults — investigation and management', year: '2014', url: 'https://www.nice.org.uk/guidance/cg184' },
      { name: 'American College of Gastroenterology (ACG) clinical guideline for the diagnosis and management of gastroesophageal reflux disease, American Journal of Gastroenterology', year: '2022' },
      { name: 'Management of Helicobacter pylori infection: the Maastricht VI/Florence consensus report, Gut', year: '2022' },
    ],
    ...DRAFT,
  },

  // 6 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'diabetic-foot',
    slug: 'diabetic-foot-care',
    title: 'Diabetic foot care',
    summary:
      'Why diabetes puts the feet at risk, a simple daily foot-care routine, how often feet should be checked, and the signs that need help the same day.',
    sections: [
      {
        heading: 'Why feet matter in diabetes',
        paragraphs: [
          'Over time, diabetes can reduce the feeling in the feet (neuropathy) and the blood supply to them. A small cut, blister or burn may then go unnoticed, heal slowly and become infected. Most serious foot problems can be prevented, or treated early, with daily care and prompt attention to any change.',
        ],
      },
      {
        heading: 'Your daily routine',
        bullets: [
          'Check both feet every day, including the soles and between the toes. Use a mirror, or ask a family member to help.',
          'Wash your feet daily in lukewarm water. Test the water with your elbow, not your foot.',
          'Dry them carefully, especially between the toes.',
          'Moisturise dry skin, but not between the toes.',
          'Cut toenails straight across and file any sharp edges. If you cannot see or reach your feet well, ask for help from a foot-care professional.',
          'Do not cut corns or hard skin yourself, and avoid corn plasters and chemical remedies. See a podiatrist or the clinic instead.',
        ],
      },
      {
        heading: 'Footwear and everyday life',
        bullets: [
          'Avoid walking barefoot, in socks only, or in thin-soled slippers — indoors, outdoors, on the beach and on hot sand or pavements.',
          'Wear well-fitting shoes, and break new shoes in gradually.',
          'Check inside your shoes for stones or rough areas before putting them on.',
          'Wear clean socks without tight tops, and change them daily.',
          'Keep feet away from hot-water bottles, heating pads and very hot surfaces.',
        ],
      },
      {
        heading: 'Regular foot checks',
        paragraphs: [
          'Everyone with diabetes should have their feet examined by a health professional at least once a year. People at higher risk — for example with reduced feeling, poor circulation, or a previous ulcer or amputation — need checks more often. Our diabetic foot clinic can provide these assessments.',
          'Looking after your diabetes as a whole also protects your feet: keeping blood sugar, blood pressure and cholesterol in the ranges agreed with your diabetes team, and not smoking.',
        ],
      },
      {
        heading: 'If you notice a problem',
        paragraphs: [
          'Contact the clinic or your diabetes team the same day or the next day about any new cut, blister, sore, swelling or colour change, even if it does not hurt. Cover a wound with a clean, dry dressing and keep weight off the foot as much as possible until it has been seen. Do not wait for a wound to get worse before seeking review.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'A foot that is red, hot, swollen or painful — with or without a wound.',
        'Spreading redness, pus or a bad smell from a wound.',
        'Fever, shivering or feeling very unwell with a foot wound, or blood sugar readings much higher than usual.',
        'A toe or part of the foot turning blue, grey or black.',
        'Sudden severe pain, coldness or numbness in the foot or leg.',
      ],
    },
    sources: [
      { name: 'International Working Group on the Diabetic Foot (IWGDF): Guidelines on the prevention and management of diabetes-related foot disease', year: '2023', url: 'https://iwgdfguidelines.org' },
      { name: 'American Diabetes Association: Standards of Care in Diabetes (foot care recommendations)', year: '2025' },
      { name: 'NICE NG19: Diabetic foot problems — prevention and management', year: '2015', url: 'https://www.nice.org.uk/guidance/ng19' },
    ],
    ...DRAFT,
  },

  // 7 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'breast-lumps-screening',
    slug: 'breast-lumps-and-breast-screening',
    title: 'Breast lumps and breast screening',
    summary:
      'Knowing what is normal for you, which changes to report, what happens at a breast clinic assessment, and how screening mammograms fit in.',
    sections: [
      {
        heading: 'Be breast aware',
        paragraphs: [
          'Breast awareness means knowing how your breasts normally look and feel, so that you notice changes. Breasts often feel different at different times of the menstrual cycle. There is no special technique: look and feel regularly, including up into the armpits, and report any change promptly.',
        ],
      },
      {
        heading: 'Changes to report',
        bullets: [
          'A new lump or thickening in the breast or armpit.',
          'A change in the size or shape of a breast.',
          'Dimpling, puckering or redness of the skin.',
          'A nipple that has newly turned inwards, a rash on or around the nipple, or discharge from the nipple — especially if it is bloodstained.',
          'Pain in one particular area that does not go away.',
        ],
        paragraphs: ['Men can also develop breast cancer, and should report a lump or nipple change in the same way.'],
      },
      {
        heading: 'Most breast lumps are not cancer',
        paragraphs: [
          'Most breast lumps turn out to be benign — for example a fluid-filled cyst, a fibroadenoma (a smooth, rubbery lump of breast tissue) or normal lumpiness. Even so, every new lump should be checked by a doctor.',
        ],
      },
      {
        heading: 'What happens at the breast clinic',
        paragraphs: [
          'Assessment usually combines three parts, sometimes called "triple assessment":',
        ],
        bullets: [
          'Examination by the surgeon.',
          'Imaging: an ultrasound scan and/or a mammogram, depending on your age and the findings.',
          'A needle biopsy if needed, to take a small sample of tissue for testing.',
          'Results are discussed with you in person, together with any next steps.',
        ],
      },
      {
        heading: 'Screening mammograms',
        paragraphs: [
          'Screening is for women who have no symptoms. Recommendations differ between organisations. The US Preventive Services Task Force (2024) recommends a mammogram every two years from age 40 to 74. The American College of Radiology recommends yearly screening from age 40, and a breast cancer risk assessment by age 25 to identify women at higher risk.',
          'Women at higher risk — for example with a strong family history, a known inherited gene change such as BRCA, or previous radiotherapy to the chest — may need screening earlier or more often, sometimes including MRI. Please discuss your own risk with your doctor.',
          'If you have a symptom, do not wait for a screening appointment: book a clinic assessment.',
        ],
      },
      {
        heading: 'Looking after your breast health',
        paragraphs: [
          'Keeping active, keeping to a healthy weight and limiting alcohol are all linked with a lower risk of breast cancer.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'A red, hot, very painful and swollen breast with a high temperature or feeling very unwell — including while breastfeeding.',
        'Redness of the breast that is spreading quickly.',
        'After breast surgery: rapidly increasing swelling of the breast or wound, bleeding that does not stop, or a fever.',
      ],
    },
    sources: [
      { name: 'US Preventive Services Task Force: Breast cancer screening recommendation', year: '2024', url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening' },
      { name: 'American College of Radiology (ACR): Breast cancer screening in women at higher-than-average risk — updated recommendations, Journal of the American College of Radiology', year: '2023' },
      { name: 'NICE NG12: Suspected cancer — recognition and referral', year: '2015', url: 'https://www.nice.org.uk/guidance/ng12' },
      { name: 'NICE CG164: Familial breast cancer', year: '2013', url: 'https://www.nice.org.uk/guidance/cg164' },
    ],
    ...DRAFT,
  },

  // 8 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'thyroid-nodules',
    slug: 'thyroid-nodules',
    title: 'Thyroid nodules and neck lumps',
    summary:
      'What thyroid nodules are, the tests used to assess them, when monitoring is enough and when an operation is advised.',
    sections: [
      {
        heading: 'The thyroid gland',
        paragraphs: [
          'The thyroid is a butterfly-shaped gland at the front of the neck, below the Adam\'s apple. It makes hormones that help control the body\'s metabolism.',
        ],
      },
      {
        heading: 'What is a thyroid nodule?',
        paragraphs: [
          'A nodule is a lump within the thyroid gland. Nodules are very common, and are often found by chance on a scan done for another reason. Most thyroid nodules are benign (not cancer).',
        ],
      },
      {
        heading: 'Symptoms',
        bullets: [
          'Often none.',
          'A lump or swelling you can see or feel in the neck.',
          'A feeling of pressure, or difficulty swallowing.',
          'A hoarse voice that does not go away.',
          'Occasionally, symptoms of an overactive or underactive thyroid, such as changes in weight, energy or heart rate.',
        ],
      },
      {
        heading: 'Tests',
        bullets: [
          'A blood test to check how the thyroid is working (TSH).',
          'An ultrasound scan of the neck. Nodules are graded using a scoring system (such as ACR TI-RADS or the British Thyroid Association "U" grading), which guides whether a needle test is needed.',
          'A fine-needle aspiration (FNA): a thin needle, usually guided by ultrasound, takes a small sample of cells. Results are reported using an international scale (the Bethesda System). Some results are "indeterminate", meaning further tests or a diagnostic operation may be recommended.',
          'Sometimes other scans, for example if the thyroid is overactive.',
        ],
      },
      {
        heading: 'Treatment options',
        paragraphs: [
          'Many nodules only need monitoring with repeat ultrasound scans. An operation may be recommended if a nodule is suspicious or confirmed as cancer, if it is large enough to cause pressure symptoms, or for some overactive nodules.',
          'The operation removes either half of the thyroid (hemithyroidectomy) or all of it (total thyroidectomy). After a total thyroidectomy, lifelong thyroid hormone replacement is needed, which your doctor will arrange and monitor. After removal of half the gland, the remaining half often makes enough hormone on its own, and a blood test will check this.',
          'Your surgeon will explain the risks, which include a change in the voice (the nerves to the voice box run close to the thyroid), low calcium levels after a total thyroidectomy (because of the nearby parathyroid glands) and bleeding.',
          'The most common types of thyroid cancer usually respond very well to treatment.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Difficulty breathing, or noisy breathing.',
        'A neck lump that grows quickly over a few days.',
        'Being unable to swallow your own saliva.',
        'After thyroid surgery: swelling in the neck, especially with difficulty breathing or swallowing.',
        'After thyroid surgery: tingling around the mouth or in the fingers, or muscle cramps or spasms.',
      ],
    },
    sources: [
      { name: 'American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer (published in Thyroid, 2016)', year: '2015' },
      { name: 'British Thyroid Association: Guidelines for the management of thyroid cancer, 3rd edition, Clinical Endocrinology', year: '2014' },
      { name: 'ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS Committee, Journal of the American College of Radiology', year: '2017' },
      { name: 'The Bethesda System for Reporting Thyroid Cytopathology, 3rd edition', year: '2023' },
    ],
    ...DRAFT,
  },

  // 9 ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ercp',
    slug: 'ercp',
    title: 'ERCP: what to expect',
    summary:
      'What an ERCP is, why it is done, how to prepare, and what to expect on the day and afterwards. At Amise Medical Services, ERCP is performed under general anaesthetic at Tapion Hospital.',
    sections: [
      {
        heading: 'What is an ERCP?',
        paragraphs: [
          'ERCP stands for endoscopic retrograde cholangiopancreatography. A thin, flexible camera is passed through the mouth, down the gullet and stomach, into the first part of the small bowel, where the bile duct and the pancreatic duct open. X-ray images are taken during the procedure.',
          'Today, an ERCP is done mainly to treat a problem rather than just to look. The diagnosis is usually made first with scans such as an MRCP or an endoscopic ultrasound.',
        ],
      },
      {
        heading: 'Why it is done',
        bullets: [
          'To remove gallstones from the bile duct.',
          'To relieve a blockage of the bile duct that is causing jaundice (yellowing of the skin or eyes).',
          'To drain an infected bile duct (cholangitis).',
          'To treat a bile leak, for example after gallbladder surgery.',
          'To widen or place a stent (a small tube) in a narrowed duct, or to take samples.',
        ],
      },
      {
        heading: 'Where and how',
        paragraphs: [
          'Dr Kabiye performs ERCP at Tapion Hospital, under a general anaesthetic, so you will be asleep throughout. You will be in hospital for several hours, and some patients stay overnight.',
        ],
      },
      {
        heading: 'Before the procedure',
        bullets: [
          'You will have a pre-procedure assessment, which may include blood tests, and a discussion of the benefits, risks and alternatives before you give consent.',
          'The clinic will give you written instructions, including when to stop eating and drinking. Please follow them exactly.',
          'If you take blood thinners, insulin or diabetes medicines, please call the clinic before your appointment for instructions.',
          'Tell the team about any allergies (including to X-ray contrast dye), and if you are or might be pregnant.',
          'A responsible adult must bring you, take you home, and stay with you for 24 hours. For 24 hours after the anaesthetic you should not drive, drink alcohol, operate machinery or sign important documents.',
        ],
      },
      {
        heading: 'During the procedure',
        paragraphs: [
          'Often a small cut is made at the opening of the bile duct (a sphincterotomy) so that stones can be removed with a small balloon or basket. A stent may be placed to keep a duct open. Large or difficult stones sometimes need a second procedure. If a stent is placed, the team will tell you whether and when it needs to be changed or removed.',
        ],
      },
      {
        heading: 'Afterwards',
        paragraphs: [
          'A sore throat and some bloating are common for a day or so. The team will tell you when you can eat and drink again, and will explain what was found and done. If you still have your gallbladder and it contains stones, an operation to remove it is often recommended afterwards, to stop stones coming back into the bile duct.',
        ],
      },
      {
        heading: 'Risks',
        paragraphs: [
          'ERCP is a specialised procedure with some important risks. The most common is inflammation of the pancreas (pancreatitis). Others include bleeding, infection, a tear in the bowel or bile duct wall (perforation), the risks of the anaesthetic, and the procedure not being successful. Dr Kabiye will explain what these risks mean for you before you decide.',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Severe or worsening pain in the abdomen, especially if it spreads to the back.',
        'Fever, shivering or chills.',
        'Vomiting that will not settle.',
        'Vomiting blood, or black, tarry stools.',
        'New or worsening yellowing of the skin or eyes.',
        'Chest pain, breathlessness, or pain on swallowing.',
      ],
    },
    sources: [
      { name: 'British Society of Gastroenterology (BSG): Updated guideline on the management of common bile duct stones, Gut', year: '2017' },
      { name: 'American Society for Gastrointestinal Endoscopy (ASGE) guideline on the role of endoscopy in the evaluation and management of choledocholithiasis, Gastrointestinal Endoscopy', year: '2019' },
      { name: 'European Society of Gastrointestinal Endoscopy (ESGE) guideline: ERCP-related adverse events, Endoscopy', year: '2020' },
    ],
    ...DRAFT,
  },

  // 10 ────────────────────────────────────────────────────────────────────────
  {
    id: 'preparing-for-surgery',
    slug: 'preparing-for-surgery',
    title: 'Preparing for surgery: what to expect',
    summary:
      'How to get ready for an operation, what happens at the pre-operative assessment and on the day, and how to support your recovery at home.',
    sections: [
      {
        heading: 'Deciding together',
        paragraphs: [
          'Before any planned operation, your surgeon will explain what is involved, the expected benefits, the risks, and the alternatives — including not having an operation. Please ask as many questions as you need. You can take time to decide, and you can change your mind.',
        ],
      },
      {
        heading: 'The pre-operative assessment',
        paragraphs: [
          'You will usually have an assessment before the day of surgery. The team will ask about your health, check your blood pressure and other measurements, arrange any tests that are needed for you (not every patient needs the same tests), and discuss the anaesthetic.',
        ],
        bullets: [
          'Bring all your medicines, or an up-to-date list, including herbal and over-the-counter remedies.',
          'If you take insulin, blood thinners or diabetes medicines, please call the clinic before your operation for instructions.',
          'The team will give you written advice about your medicines. Please ask if anything is unclear.',
        ],
      },
      {
        heading: 'Getting fit for surgery',
        bullets: [
          'Stopping smoking, even a few weeks before surgery, helps wounds heal and lowers the risk of chest problems.',
          'Cutting down on alcohol.',
          'Keeping active — for example a daily walk.',
          'Eating well, with enough protein, fruit and vegetables.',
          'If you have diabetes, working with your diabetes team to keep your blood sugar well controlled.',
          'Arranging help at home for the first days after your operation.',
        ],
      },
      {
        heading: 'Eating and drinking before an anaesthetic',
        paragraphs: [
          'You will be given written times for when to stop eating and when to stop drinking before your operation. Please follow those times exactly. You should not go without food or drink for longer than you have been told: it can leave you feeling unwell and does not make the anaesthetic safer.',
        ],
      },
      {
        heading: 'On the day',
        bullets: [
          'Shower beforehand, and remove jewellery, make-up and nail varnish.',
          'Bring your medicines or list, your glasses, and any breathing machine you use at night (such as CPAP).',
          'Arrange for a responsible adult to take you home and stay with you for 24 hours after a general anaesthetic or sedation. You should not drive, drink alcohol, operate machinery or sign important documents during that time.',
        ],
      },
      {
        heading: 'After your operation',
        bullets: [
          'Getting up, walking, and eating and drinking early all help recovery.',
          'You will be given advice about pain relief to use at home and how to look after your wound.',
          'Moving about and drinking enough fluids help to lower the risk of blood clots. Some patients are also given stockings or injections to reduce this risk.',
          'The team will tell you when your follow-up appointment is and when you can expect to return to work, exercise and driving.',
        ],
      },
      {
        heading: 'Questions you may want to ask',
        bullets: [
          'What are the benefits and risks of the operation for me, and what are the alternatives?',
          'What type of anaesthetic will I have?',
          'How long will I be in hospital, and how long will recovery take?',
          'When can I return to work, exercise and driving?',
          'Who do I contact if I have a problem after I go home?',
        ],
      },
    ],
    whenToSeekUrgentCare: {
      intro: SEEK_URGENT_CARE,
      signs: [
        'Chest pain or difficulty breathing.',
        'A painful, swollen, hot calf or leg.',
        'Heavy bleeding from a wound.',
        'A fever, or redness spreading from a wound, or pus.',
        'Severe or worsening pain that is not controlled.',
        'Being unable to pass urine, or vomiting and being unable to keep fluids down.',
        'New confusion or unusual drowsiness.',
      ],
    },
    sources: [
      { name: 'NICE NG45: Routine preoperative tests for elective surgery', year: '2016', url: 'https://www.nice.org.uk/guidance/ng45' },
      { name: 'NICE NG180: Perioperative care in adults', year: '2020', url: 'https://www.nice.org.uk/guidance/ng180' },
      { name: 'World Health Organization: Surgical Safety Checklist', year: '2009' },
    ],
    ...DRAFT,
  },
];

// ── Accessors ────────────────────────────────────────────────────────────────

export function isApproved(article: HealthArticle): boolean {
  return article.status === 'approved';
}

/** Articles the public may see, in library order. */
export function getApprovedArticles(articles: readonly HealthArticle[] = HEALTH_ARTICLES): HealthArticle[] {
  return articles.filter(isApproved);
}

/** An approved article by slug, or undefined (drafts are never returned). */
export function getApprovedArticle(slug: string, articles: readonly HealthArticle[] = HEALTH_ARTICLES): HealthArticle | undefined {
  return articles.find(a => a.slug === slug && isApproved(a));
}

export function hasApprovedArticles(articles: readonly HealthArticle[] = HEALTH_ARTICLES): boolean {
  return articles.some(isApproved);
}

/** Every string a reader can see in an article (for the text-safety lint). */
export function articleText(article: HealthArticle): string[] {
  return [
    article.title,
    article.summary,
    ...article.sections.flatMap(s => [s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]),
    article.whenToSeekUrgentCare.intro,
    ...article.whenToSeekUrgentCare.signs,
  ];
}

/** "25 September 2026" from "2026-09-25" (no time-zone shift). */
export function formatReviewDate(date: string | null): string {
  if (!date) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}
