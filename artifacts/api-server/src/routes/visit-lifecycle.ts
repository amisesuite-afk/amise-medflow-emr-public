import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

// POST /api/visit/check-in/:appointmentId -- mark patient arrived, create encounter
router.post('/api/visit/check-in/:appointmentId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { appointmentId } = req.params;
  const { site } = req.body ?? {};

  try {
    const supa = getSupabaseAdmin();

    // Look up the appointment (check confirmed_appointments first, then appointment_requests)
    let appointment: any = null;
    let patientId: string | null = null;
    let appointmentType: string | null = null;
    let chiefComplaint: string | null = null;

    const { data: confirmed } = await supa
      .from('confirmed_appointments')
      .select('*')
      .eq('id', appointmentId)
      .in('status', ['confirmed'])
      .maybeSingle();

    if (confirmed) {
      appointment = confirmed;
      patientId = confirmed.patient_id;
      appointmentType = confirmed.appointment_type;
    } else {
      // Fall back to appointment_requests (patient_confirmed status)
      const { data: request } = await supa
        .from('appointment_requests')
        .select('*')
        .eq('id', appointmentId)
        .in('status', ['patient_confirmed', 'staff_confirmed', 'doctor_confirmed'])
        .maybeSingle();

      if (request) {
        appointment = request;
        chiefComplaint = request.reason;
        appointmentType = request.appointment_type;

        // Resolve or create patient record for web/phone bookings that have no patient_id yet
        if (request.patient_id) {
          patientId = request.patient_id as string;
        } else {
          const phone = (request.patient_phone ?? request.phone ?? null) as string | null;
          const name = (request.patient_name ?? 'Unknown') as string;
          const email = (request.patient_email ?? request.email ?? null) as string | null;

          // Try to find existing patient by phone
          if (phone) {
            const { data: existingPt } = await supa
              .from('patients')
              .select('id')
              .eq('phone', phone)
              .maybeSingle();
            if (existingPt) patientId = (existingPt as { id: string }).id;
          }

          // Create patient if still not found
          if (!patientId) {
            const { data: newPt, error: ptErr } = await supa
              .from('patients')
              .insert({ full_name: name, phone: phone ?? null, email: email ?? null })
              .select('id')
              .single();
            if (ptErr) throw ptErr;
            patientId = (newPt as { id: string }).id;
          }

          // Back-link the booking to the resolved patient
          await supa
            .from('appointment_requests')
            .update({ patient_id: patientId })
            .eq('id', appointmentId);
        }
      }
    }

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found or not in a confirmable state' });
      return;
    }

    if (!patientId) {
      res.status(422).json({ error: 'Cannot create encounter: no patient record could be resolved' });
      return;
    }

    // Create encounter
    const { data: encounter, error: encErr } = await supa
      .from('encounters')
      .insert({
        patient_id: patientId,
        encounter_date: new Date().toISOString(),
        encounter_type: 'outpatient',
        chief_complaint: chiefComplaint ?? appointmentType,
        status: 'open',
        site: site ?? appointment.location ?? 'rodney_bay',
      })
      .select('id')
      .single();

    if (encErr) throw encErr;

    // Update appointment status to 'attended'
    if (confirmed) {
      await supa.from('confirmed_appointments').update({ status: 'completed' }).eq('id', appointmentId);
    } else {
      // For appointment_requests, we just mark it checked in via notes
      await supa.from('appointment_requests').update({ notes: 'Patient checked in' }).eq('id', appointmentId);
    }

    await audit({
      action: 'book',
      entityType: 'encounter',
      entityId: encounter.id,
      payload: { status: 'check_in', appointment_id: appointmentId, encounter_type: 'outpatient' },
    });

    logger.info({ encounterId: encounter.id, appointmentId }, '[visit/check-in] patient checked in');
    res.json({ encounterId: encounter.id, patientId, status: 'checked_in' });
  } catch (err) {
    logger.error({ err }, '[visit/check-in] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/visit/complete/:encounterId -- close encounter with plan
router.post('/api/visit/complete/:encounterId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { encounterId } = req.params;
  const { planType, description, followUpDate, followUpNotes, referralTo, referralSpecialty, referralReason, referralUrgency } = req.body ?? {};

  try {
    const supa = getSupabaseAdmin();

    // Verify encounter exists and is open
    const { data: encounter, error: fetchErr } = await supa
      .from('encounters')
      .select('id, patient_id, status')
      .eq('id', encounterId)
      .in('status', ['open', 'in_progress'])
      .maybeSingle();

    if (fetchErr || !encounter) {
      res.status(404).json({ error: 'Encounter not found or already closed' });
      return;
    }

    // Create plan
    const resolvedPlanType = planType ?? 'management';
    const { error: planErr } = await supa
      .from('plans')
      .upsert({
        encounter_id: encounterId,
        patient_id: encounter.patient_id,
        plan_type: resolvedPlanType,
        description: description ?? null,
        follow_up_date: followUpDate ?? null,
        follow_up_notes: followUpNotes ?? null,
      }, { onConflict: 'encounter_id' });

    if (planErr) throw planErr;

    // Create referral if specified
    if (referralTo) {
      await supa.from('referrals').insert({
        patient_id: encounter.patient_id,
        encounter_id: encounterId,
        referral_to: referralTo,
        specialty: referralSpecialty ?? null,
        reason: referralReason ?? null,
        urgency: referralUrgency ?? 'routine',
        status: 'pending',
      });
    }

    // Sign all draft clinical notes before closing
    await supa
      .from('clinical_notes')
      .update({ status: 'signed', updated_at: new Date().toISOString() })
      .eq('encounter_id', encounterId)
      .eq('status', 'draft');

    // Close encounter
    const { error: closeErr } = await supa
      .from('encounters')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', encounterId);

    if (closeErr) throw closeErr;

    await audit({
      action: 'book',
      entityType: 'encounter',
      entityId: encounterId,
      payload: { status: 'closed', plan_type: resolvedPlanType, has_follow_up: !!followUpDate, has_referral: !!referralTo },
    });
    void logAudit(req, 'update', 'appointment', encounterId, encounter.patient_id ?? undefined, {
      action: 'complete',
      plan_type: resolvedPlanType,
      has_follow_up: !!followUpDate,
      has_referral: !!referralTo,
    });

    logger.info({ encounterId, planType: resolvedPlanType, followUpDate }, '[visit/complete] encounter closed');
    res.json({ encounterId, status: 'closed', planType: resolvedPlanType });
  } catch (err) {
    logger.error({ err }, '[visit/complete] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/visit/no-show/:appointmentId -- mark appointment as no-show
router.post('/api/visit/no-show/:appointmentId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { appointmentId } = req.params;

  try {
    const supa = getSupabaseAdmin();

    // Try confirmed_appointments first
    const { data: confirmed } = await supa
      .from('confirmed_appointments')
      .update({ status: 'no_show' })
      .eq('id', appointmentId)
      .in('status', ['confirmed'])
      .select('id')
      .maybeSingle();

    if (!confirmed) {
      // Try appointments table
      const { data: appt } = await supa
        .from('appointments')
        .update({ status: 'no_show' })
        .eq('id', appointmentId)
        .in('status', ['scheduled', 'confirmed'])
        .select('id')
        .maybeSingle();

      if (!appt) {
        res.status(404).json({ error: 'Appointment not found or not in a valid state' });
        return;
      }
    }

    await audit({
      action: 'skip',
      entityType: 'appointment',
      entityId: appointmentId,
      payload: { status: 'no_show' },
    });

    logger.info({ appointmentId }, '[visit/no-show] marked');
    res.json({ appointmentId, status: 'no_show' });
  } catch (err) {
    logger.error({ err }, '[visit/no-show] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/visit/medication-reconciliation/:encounterId -- record medication review
router.post('/api/visit/medication-reconciliation/:encounterId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { encounterId } = req.params;
  const { medications } = req.body ?? {};

  if (!Array.isArray(medications)) {
    res.status(400).json({ error: 'medications array required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: encounter } = await supa
      .from('encounters')
      .select('patient_id')
      .eq('id', encounterId)
      .maybeSingle();

    if (!encounter) {
      res.status(404).json({ error: 'Encounter not found' });
      return;
    }

    // Upsert each medication for this encounter
    for (const med of medications) {
      await supa.from('medications').upsert({
        patient_id: encounter.patient_id,
        encounter_id: encounterId,
        drug_name: med.drugName,
        dose: med.dose ?? null,
        frequency: med.frequency ?? null,
        route: med.route ?? 'oral',
        indication: 'consultation-list',
        status: med.status ?? 'active',
      }, { onConflict: 'patient_id,encounter_id,drug_name,indication' });
    }

    await audit({
      action: 'extract',
      entityType: 'encounter',
      entityId: encounterId,
      payload: { action: 'medication_reconciliation', count: medications.length },
    });

    logger.info({ encounterId, count: medications.length }, '[visit/med-recon] reconciled');
    res.json({ encounterId, reconciled: medications.length });
  } catch (err) {
    logger.error({ err }, '[visit/med-recon] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/visit/sign-notes/:encounterId -- sign all draft clinical notes for an encounter
router.post('/api/visit/sign-notes/:encounterId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { encounterId } = req.params;

  try {
    const supa = getSupabaseAdmin();

    const { data: encounter, error: fetchErr } = await supa
      .from('encounters')
      .select('id, patient_id')
      .eq('id', encounterId)
      .maybeSingle();

    if (fetchErr || !encounter) {
      res.status(404).json({ error: 'Encounter not found' });
      return;
    }

    const { data: updated, error: signErr } = await supa
      .from('clinical_notes')
      .update({ status: 'signed', updated_at: new Date().toISOString() })
      .eq('encounter_id', encounterId)
      .eq('status', 'draft')
      .select('id');

    if (signErr) throw signErr;

    const signed = updated?.length ?? 0;

    await audit({
      action: 'sign',
      entityType: 'clinical_notes',
      entityId: encounterId,
      patientId: encounter.patient_id ?? undefined,
      payload: { notes_signed: signed },
    });

    logger.info({ encounterId, signed }, '[visit/sign-notes] notes signed');
    res.json({ encounterId, signed });
  } catch (err) {
    logger.error({ err }, '[visit/sign-notes] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/visit/open-encounters -- list encounters not yet closed (for end-of-day review)
router.get('/api/visit/open-encounters', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('encounters')
      .select('id, patient_id, encounter_date, encounter_type, chief_complaint, status, site')
      .in('status', ['open', 'in_progress'])
      .order('encounter_date', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ encounters: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[visit/open-encounters] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
