> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Patient privacy notice (draft)

> Drafting notes for the reviewer are in *italic blocks marked "Note to reviewer"*. Remove them before publication. Every factual statement about systems has been checked against the code (see `data-inventory.md`). Anything marked [to confirm] must be completed before use.

---

## How Amise Medical Services looks after your information

**Amise Medical Services**, Dr Dawit Daniel Kabiye, MD, DM
Rodney Bay (Providence Building) and Tapion Hospital (La Toc, Castries), Saint Lucia
Telephone: 758-284-0557 / 758-720-7111 · Email: [to confirm]
Last updated: [date]

We take your privacy seriously. This notice explains what information we hold about you, why we hold it, who we share it with, how long we keep it, and what your rights are.

### 1. Who we are

Amise Medical Services is a specialist general and endoscopic surgery practice in Saint Lucia. We are responsible for the personal information described in this notice.

*Note to reviewer:* confirm the legal entity name and registered address. Confirm whether the practice must register with, or name, a data-protection authority or Commissioner under the Data Protection Act, 2011 of Saint Lucia. The Act's commencement status and any registration requirement are **to confirm with Saint Lucia counsel**.

### 2. The information we hold

We collect only what we need to arrange and provide your care. This may include:

- **Your details:** name, date of birth, sex, address, telephone number, email address, next of kin, insurance details and a photograph for identification.
- **Your health information:** your symptoms and the reason for your visit; your medical, surgical, family and social history; medicines and allergies; examination findings and observations; test results and reports; diagnoses; procedure and operation records; letters to and from other doctors; and photographs taken as part of your care, such as wound photographs.
- **Screening and wellbeing questionnaires** you complete, which may include questions about mood or alcohol use.
- **Communications with us:** emails, text and WhatsApp messages, voicemails, and **recordings of telephone calls** with our team [to confirm: when calls are recorded and how you are told].
- **Appointment and billing information.**
- **If you use our patient portal:** your login details and a record of when you sign in.

Health information is **sensitive personal data**. We handle it with extra care.

### 3. Why we use it

We use your information to:

- arrange and confirm appointments, and send you reminders and preparation instructions;
- assess, diagnose and treat you, and plan and carry out procedures;
- keep an accurate medical record;
- communicate with other professionals involved in your care (for example your GP, the hospital and the laboratory), and with your insurer where you have asked us to;
- bill for our services;
- keep you and others safe, and meet our legal and professional obligations;
- review and improve the quality and safety of our care. Where we use information for audit or research, we remove details that identify you, unless you have agreed otherwise or the law allows it.

*Note to reviewer:* set out the lawful grounds under the Saint Lucia Act (for example consent, provision of health care by a health professional, and legal obligation). **To confirm with counsel.**

### 4. Our booking forms and messages are not medical advice

Our online form, our WhatsApp and text service, and our automated emails are there to **help us schedule your visit**. They do not assess or diagnose your condition.

**If you think you have a medical emergency, call 911 or go to the nearest Emergency Department straight away. Do not wait for a reply from us.**

### 5. Use of computer tools and artificial intelligence

We use a computer system to keep your records and help our clinicians.

- **Computer tools.** Some tools calculate clinical scores or suggest things for the clinician to consider. **A doctor always makes the decisions about your care.** No computer tool diagnoses you, prescribes for you, or decides your treatment.
- **Artificial intelligence (AI).** We may use AI services to help draft letters and reports, to organise information you send us, and to help transcribe dictation. When we do, the relevant information is sent securely to the AI provider for processing. Everything the AI drafts is checked by a member of our clinical team before it is used.

*Note to reviewer: this wording must match production.* Today the web and API systems send identifiable information (names, dates of birth and clinical details) to Anthropic, and optionally call audio to OpenAI. The iOS app's AI features are switched off.

Choose one of the following before publication:

- (a) keep the wording above, list the providers in section 6, and have agreements in place; or
- (b) switch these services off until agreements are signed, and remove this paragraph.

Also decide whether patients can opt out of AI processing, and how that opt-out would be honoured technically. No opt-out mechanism exists in the code today.

### 6. Who we share your information with

We share information only when it is needed for your care, when you have agreed, or when the law requires it. We may share it with:

- **Other people caring for you**, such as your GP, the hospital, the laboratory and imaging services, and specialists we refer you to.
- **Your insurer**, if you ask us to claim on your behalf.
- **Our service providers**, who store or process information for us under contract and only on our instructions:

| Provider | Service |
|---|---|
| Supabase | Secure database, file storage and logins |
| Render and Vercel | Hosting of our systems |
| Google (Gmail and Calendar) | Email and appointment calendar |
| Twilio | Text messages, WhatsApp messages and telephone services |
| Anthropic | AI drafting (if used, see section 5) |
| OpenAI | Call transcription, if enabled |
| Sentry | Error monitoring. We aim not to send patient information |
| GitHub | Runs our encrypted backup process |
| Apple | iPhone and iPad services we use, including dictation |

Some of these providers store information **outside Saint Lucia**, for example in the United States [to confirm the regions]. Where that happens we take steps to protect your information [to confirm the safeguards used].

*Note to reviewer:* keep this list in step with `subprocessors.md`. Remove Meta and Telnyx unless they are in use.

- **Others where the law requires it**, for example a court order, public-health reporting or safeguarding.

We **do not sell** your information, and we do not use it for marketing without your consent.

### 7. How we keep it safe

Our safeguards include:

- staff logins with individual accounts and role-based access;
- encrypted connections;
- a device lock (Face ID or passcode) on the practice's iPhones and iPads;
- access logging;
- encrypted backups.

Only staff who need your information for their job can see it.

*Note to reviewer:* do not overstate these safeguards. Known gaps are listed in `security-controls.md` and should be closed before this notice is published. In particular, the notice should not claim that access is limited by role until the server-side checks S-2 and S-3 are fixed.

### 8. How long we keep it

We keep your medical records for [to confirm: the period required by Saint Lucia law and professional guidance, for example X years after your last visit, or longer for children]. After that we securely delete or anonymise them. Backups are kept for up to [to confirm: currently 7 years for yearly backups] and are then deleted.

*Note to reviewer:* no automated deletion exists in the system today (see `data-inventory.md` §3). A retention schedule and a disposal process must be built to match whatever this section promises.

### 9. Your rights

Under the Data Protection Act, 2011 of Saint Lucia [to confirm the precise rights and wording with counsel], you may ask us to:

- tell you what information we hold about you and give you a copy;
- correct information that is wrong;
- stop or limit certain uses of your information, where the law allows;
- explain how a decision about you was made.

To make a request, contact us using the details above. We may need to confirm your identity. We will reply within [to confirm] days. We will not charge you unless the law allows it.

If you are unhappy with how we have handled your information, please tell us first. You may also complain to [to confirm: the relevant Saint Lucia authority].

### 10. Text messages, WhatsApp and email

- If you give us your mobile number or email address, we will use it to send appointment confirmations, reminders and preparation instructions.
- These messages are kept short and do not include test results or diagnoses.
- Please tell us if you share your phone or email with someone else, or if you would prefer a different way to be contacted.
- WhatsApp and email are convenient, but they are not completely private. Please do not send us urgent medical information this way.

### 11. Changes to this notice

We may update this notice. The latest version is always available at [URL] and at reception.

---

## Annex A: Notes for future markets (not part of the patient notice)

### UK GDPR / EU GDPR

- Health data is **special-category data** (Art. 9). A lawful basis is needed under both Art. 6 (for example 6(1)(e) or 6(1)(b)) and Art. 9 (typically 9(2)(h), health care, with professional secrecy).
- A **DPIA** (Art. 35) is required because the processing involves large-scale health data and new technology (AI).
- **Art. 28 processor contracts** are needed with every vendor in `subprocessors.md`. International transfers need an adequacy decision, SCCs or the UK IDTA.
- The notice must name the controller and the DPO, if one is required. It must give the retention period, the transfer mechanism and the right to complain to the ICO or the relevant EU supervisory authority.
- **Automated decision-making (Art. 22).** Confirm that no solely automated decision with legal or similarly significant effect is made. The triage routing and ER redirect should be reviewed with this in mind.
- Where the software is sold to other practices: **the customer practice is the controller, and the software vendor is a processor.** A vendor DPA template will be needed.

### HIPAA (US covered entities)

- A **Notice of Privacy Practices** in the HIPAA-prescribed form replaces this notice for US patients.
- A **BAA** is needed with every business associate that creates, receives, maintains or transmits PHI (45 CFR 164.502(e), 164.504(e)). That includes this software vendor and the vendors in `subprocessors.md`.
- Security Rule risk analysis and safeguards. Breach Notification Rule procedures. The minimum-necessary standard applies to disclosures, including to AI providers.
- Some US states add stricter health-privacy laws, for example Washington's My Health My Data Act and California's CMIA. These are to be assessed per market.
