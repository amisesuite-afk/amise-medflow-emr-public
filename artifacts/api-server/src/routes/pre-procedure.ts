import { Router } from "express";
import { getSupabaseAdmin, audit, requireStaffAuth } from "../lib/supabase.js";
import { sendSms, getPrepInstructions } from "../lib/sms.js";
import { logger, errStr } from "../lib/logger.js";

const router = Router();

// Appointment types that require pre-procedure checklists
const PROCEDURE_TYPES = [
  "colonoscopy",
  "ogd",
  "egd",
  "ercp_workup",
  "flexi_sig",
  "pre_op",
];

// All checklist items with their default values
interface ChecklistData {
  prep_instructions_sent: boolean;
  prep_completed: boolean;
  consent_signed: boolean;
  bloods_done: boolean;
  fasting_confirmed: boolean;
  blood_thinners_held: boolean | null; // null = not applicable
  escort_arranged: boolean;
  allergies_verified: boolean;
}

const DEFAULT_CHECKLIST: ChecklistData = {
  prep_instructions_sent: false,
  prep_completed: false,
  consent_signed: false,
  bloods_done: false,
  fasting_confirmed: false,
  blood_thinners_held: null,
  escort_arranged: false,
  allergies_verified: false,
};

const CHECKLIST_ITEMS = Object.keys(DEFAULT_CHECKLIST) as (keyof ChecklistData)[];

/**
 * Parse a stored notes field into { checklist, originalNotes }.
 * The notes field may contain a JSON object with a __pre_procedure_checklist key,
 * or it may be plain text from before the checklist was introduced.
 */
function parseNotes(raw: string | null): {
  checklist: ChecklistData | null;
  originalNotes: string | null;
} {
  if (!raw) return { checklist: null, originalNotes: null };

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "__pre_procedure_checklist" in parsed
    ) {
      return {
        checklist: parsed.__pre_procedure_checklist as ChecklistData,
        originalNotes: parsed.__original_notes ?? null,
      };
    }
  } catch {
    // Not JSON -- treat as plain text notes
  }

  return { checklist: null, originalNotes: raw };
}

/**
 * Serialise checklist + original notes back into the notes field.
 */
function serialiseNotes(
  checklist: ChecklistData,
  originalNotes: string | null
): string {
  return JSON.stringify({
    __pre_procedure_checklist: checklist,
    __original_notes: originalNotes ?? null,
  });
}

/**
 * Compute a summary of checklist completion.
 */
function checklistSummary(checklist: ChecklistData): {
  total: number;
  completed: number;
  ready: boolean;
  items: Record<string, { verified: boolean | null; required: boolean }>;
} {
  const items: Record<string, { verified: boolean | null; required: boolean }> =
    {};
  let total = 0;
  let completed = 0;

  for (const key of CHECKLIST_ITEMS) {
    const val = checklist[key];
    // blood_thinners_held = null means not applicable (not required)
    const required = val !== null;
    items[key] = { verified: val, required };
    if (required) {
      total++;
      if (val === true) completed++;
    }
  }

  return { total, completed, ready: total > 0 && completed === total, items };
}

// ---------------------------------------------------------------------------
// POST /api/pre-procedure/checklist -- create or reset a pre-procedure checklist
// ---------------------------------------------------------------------------
router.post("/api/pre-procedure/checklist", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { appointmentId, patientId, procedureType } = req.body ?? {};

  if (!appointmentId) {
    res.status(400).json({ error: "appointmentId is required" });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Look up the appointment request
    const { data: appt, error: fetchErr } = await supa
      .from("appointment_requests")
      .select("id, notes, appointment_type, patient_name, prep_sms_sent")
      .eq("id", appointmentId)
      .maybeSingle();

    if (fetchErr || !appt) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const { originalNotes, checklist: existing } = parseNotes(appt.notes);

    // If a checklist already exists, return it instead of overwriting
    if (existing) {
      res.json({
        appointmentId,
        checklist: existing,
        summary: checklistSummary(existing),
        message: "Checklist already exists. Use verify endpoint to update items.",
      });
      return;
    }

    // Build the initial checklist
    const checklist: ChecklistData = { ...DEFAULT_CHECKLIST };

    // If prep was already sent, reflect that
    if (appt.prep_sms_sent) {
      checklist.prep_instructions_sent = true;
    }

    // Store it
    const newNotes = serialiseNotes(checklist, originalNotes);
    const { error: updateErr } = await supa
      .from("appointment_requests")
      .update({ notes: newNotes })
      .eq("id", appointmentId);

    if (updateErr) throw updateErr;

    await audit({
      action: "book",
      entityType: "appointment_request",
      entityId: appointmentId,
      payload: {
        action: "pre_procedure_checklist_created",
        procedure_type: procedureType ?? appt.appointment_type,
        patient_id: patientId ?? null,
      },
    });

    logger.info(
      { appointmentId },
      "[pre-procedure/checklist] checklist created"
    );
    res.json({
      appointmentId,
      checklist,
      summary: checklistSummary(checklist),
    });
  } catch (err) {
    logger.error({ err }, "[pre-procedure/checklist] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pre-procedure/verify/:appointmentId -- verify a single checklist item
// ---------------------------------------------------------------------------
router.post("/api/pre-procedure/verify/:appointmentId", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { appointmentId } = req.params;
  const { item, verified } = req.body ?? {};

  if (!item || typeof verified !== "boolean") {
    res
      .status(400)
      .json({ error: "item (string) and verified (boolean) are required" });
    return;
  }

  if (!CHECKLIST_ITEMS.includes(item as keyof ChecklistData)) {
    res.status(400).json({
      error: "Invalid checklist item",
      valid_items: CHECKLIST_ITEMS,
    });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: appt, error: fetchErr } = await supa
      .from("appointment_requests")
      .select("id, notes")
      .eq("id", appointmentId)
      .maybeSingle();

    if (fetchErr || !appt) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const { checklist, originalNotes } = parseNotes(appt.notes);

    if (!checklist) {
      res.status(400).json({
        error:
          "No pre-procedure checklist exists for this appointment. Create one first via POST /api/pre-procedure/checklist.",
      });
      return;
    }

    // Update the item
    const key = item as keyof ChecklistData;
    (checklist as unknown as Record<string, boolean | null>)[key] = verified;

    const newNotes = serialiseNotes(checklist, originalNotes);
    const { error: updateErr } = await supa
      .from("appointment_requests")
      .update({ notes: newNotes })
      .eq("id", appointmentId);

    if (updateErr) throw updateErr;

    // If prep_instructions_sent is being verified, also update the dedicated column
    if (key === "prep_instructions_sent" && verified) {
      await supa
        .from("appointment_requests")
        .update({ prep_sms_sent: true })
        .eq("id", appointmentId);
    }

    await audit({
      action: "book",
      entityType: "appointment_request",
      entityId: appointmentId,
      payload: {
        action: "pre_procedure_item_verified",
        item,
        verified,
      },
    });

    logger.info(
      { appointmentId, item, verified },
      "[pre-procedure/verify] item updated"
    );
    res.json({
      appointmentId,
      item,
      verified,
      checklist,
      summary: checklistSummary(checklist),
    });
  } catch (err) {
    logger.error({ err }, "[pre-procedure/verify] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pre-procedure/checklist/:appointmentId -- get checklist status
// ---------------------------------------------------------------------------
router.get(
  "/api/pre-procedure/checklist/:appointmentId",
  async (req, res) => {
    if (!(await requireStaffAuth(req, res))) return;
    const { appointmentId } = req.params;

    try {
      const supa = getSupabaseAdmin();

      const { data: appt, error: fetchErr } = await supa
        .from("appointment_requests")
        .select(
          "id, patient_name, appointment_type, location, confirmed_slot, preferred_slot, status, notes, prep_sms_sent"
        )
        .eq("id", appointmentId)
        .maybeSingle();

      if (fetchErr || !appt) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      const { checklist, originalNotes } = parseNotes(appt.notes);

      if (!checklist) {
        res.json({
          appointmentId,
          hasChecklist: false,
          appointment: {
            patientName: appt.patient_name,
            appointmentType: appt.appointment_type,
            location: appt.location,
            scheduledDate: appt.confirmed_slot ?? appt.preferred_slot,
            status: appt.status,
          },
        });
        return;
      }

      res.json({
        appointmentId,
        hasChecklist: true,
        checklist,
        summary: checklistSummary(checklist),
        originalNotes,
        appointment: {
          patientName: appt.patient_name,
          appointmentType: appt.appointment_type,
          location: appt.location,
          scheduledDate: appt.confirmed_slot ?? appt.preferred_slot,
          status: appt.status,
        },
      });
    } catch (err) {
      logger.error({ err }, "[pre-procedure/checklist] GET error");
      res.status(502).json({ error: errStr(err) });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/pre-procedure/send-prep/:appointmentId -- send prep instructions via SMS
// ---------------------------------------------------------------------------
router.post(
  "/api/pre-procedure/send-prep/:appointmentId",
  async (req, res) => {
    if (!(await requireStaffAuth(req, res))) return;
    const { appointmentId } = req.params;

    try {
      const supa = getSupabaseAdmin();

      const { data: appt, error: fetchErr } = await supa
        .from("appointment_requests")
        .select(
          "id, patient_name, patient_phone, appointment_type, notes, prep_sms_sent"
        )
        .eq("id", appointmentId)
        .maybeSingle();

      if (fetchErr || !appt) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      if (!appt.patient_phone) {
        res
          .status(400)
          .json({ error: "Patient has no phone number on file" });
        return;
      }

      const instructions = getPrepInstructions(appt.appointment_type);
      if (!instructions) {
        res.status(400).json({
          error: `No prep instructions available for appointment type: ${appt.appointment_type}`,
        });
        return;
      }

      const firstName = (appt.patient_name as string).split(" ")[0];
      const typeLabel = (appt.appointment_type as string)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      const body = `Hi ${firstName}, here are your preparation instructions for your upcoming ${typeLabel} at Amise Medical Services:\n\n${instructions}\n\nQuestions? Call ${process.env.PRACTICE_PHONE ?? "+17582840557"}. -- Amise Medical`;

      const result = await sendSms({ to: appt.patient_phone, body });
      const sent = result.action === "sent";

      // Update prep_sms_sent flag
      await supa
        .from("appointment_requests")
        .update({ prep_sms_sent: true })
        .eq("id", appointmentId);

      // Update checklist if it exists
      const { checklist, originalNotes } = parseNotes(appt.notes);
      if (checklist) {
        checklist.prep_instructions_sent = true;
        const newNotes = serialiseNotes(checklist, originalNotes);
        await supa
          .from("appointment_requests")
          .update({ notes: newNotes })
          .eq("id", appointmentId);
      }

      await audit({
        action: "send",
        entityType: "appointment_request",
        entityId: appointmentId,
        payload: {
          action: "prep_instructions_sent",
          appointment_type: appt.appointment_type,
          channel: result.channel ?? "dry_run",
          sent,
        },
      });

      logger.info(
        { appointmentId, sent, channel: result.channel },
        "[pre-procedure/send-prep] prep instructions sent"
      );
      res.json({
        appointmentId,
        sent,
        channel: result.channel ?? "dry_run",
        appointmentType: appt.appointment_type,
      });
    } catch (err) {
      logger.error({ err }, "[pre-procedure/send-prep] error");
      res.status(502).json({ error: errStr(err) });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/pre-procedure/upcoming -- list upcoming procedures needing checklists
// ---------------------------------------------------------------------------
router.get("/api/pre-procedure/upcoming", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const supa = getSupabaseAdmin();

    const now = new Date();
    const sevenDaysOut = new Date(
      now.getTime() + 7 * 24 * 60 * 60_000
    ).toISOString();
    const nowISO = now.toISOString();

    // Query appointment_requests with procedure types in the next 7 days
    const { data, error } = await supa
      .from("appointment_requests")
      .select(
        "id, patient_name, patient_phone, appointment_type, location, confirmed_slot, preferred_slot, status, notes, prep_sms_sent"
      )
      .in("appointment_type", PROCEDURE_TYPES)
      .in("status", [
        "pending",
        "staff_confirmed",
        "patient_confirmed",
      ])
      .or(
        `confirmed_slot.gte.${nowISO},preferred_slot.gte.${nowISO}`
      )
      .or(
        `confirmed_slot.lte.${sevenDaysOut},preferred_slot.lte.${sevenDaysOut}`
      )
      .order("confirmed_slot", { ascending: true, nullsFirst: false })
      .limit(100);

    if (error) throw error;

    // Filter to appointments actually within the 7-day window and enrich
    const upcoming = (data ?? [])
      .filter((row) => {
        const slot = row.confirmed_slot ?? row.preferred_slot;
        if (!slot) return true; // include unscheduled procedure requests too
        const slotDate = new Date(slot as string);
        return slotDate >= now && slotDate <= new Date(sevenDaysOut);
      })
      .map((row) => {
        const { checklist } = parseNotes(row.notes as string | null);
        return {
          appointmentId: row.id,
          patientName: row.patient_name,
          patientPhone: row.patient_phone,
          appointmentType: row.appointment_type,
          location: row.location,
          scheduledDate: row.confirmed_slot ?? row.preferred_slot,
          status: row.status,
          prepSmsSent: row.prep_sms_sent,
          hasChecklist: !!checklist,
          checklistSummary: checklist ? checklistSummary(checklist) : null,
        };
      });

    res.json({ upcoming, count: upcoming.length });
  } catch (err) {
    logger.error({ err }, "[pre-procedure/upcoming] error");
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
