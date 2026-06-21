import { Router } from "express";
import { getSupabaseAdmin, audit, requireStaffAuth } from "../lib/supabase.js";
import { logger, errStr } from "../lib/logger.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/billing/charge -- add a billing line item
// ---------------------------------------------------------------------------
router.post("/api/billing/charge", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    encounterId,
    patientId,
    chargeCode,
    chargeDescription,
    unitPriceXcd,
    category,
    quantity = 1,
    discountXcd = 0,
    notes,
  } = req.body ?? {};

  if (!encounterId || !patientId || !chargeCode || !chargeDescription || unitPriceXcd == null || !category) {
    res.status(400).json({
      error: "Required fields: encounterId, patientId, chargeCode, chargeDescription, unitPriceXcd, category",
    });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: charge, error } = await supa
      .from("billing_charges")
      .insert({
        encounter_id: encounterId,
        patient_id: patientId,
        charge_code: chargeCode,
        charge_description: chargeDescription,
        unit_price_xcd: unitPriceXcd,
        category,
        quantity,
        discount_xcd: discountXcd,
        notes: notes ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;

    await audit({
      action: "book",
      entityType: "billing_charge",
      entityId: charge.id,
      payload: {
        encounter_id: encounterId,
        patient_id: patientId,
        charge_code: chargeCode,
        amount_xcd: unitPriceXcd,
        category,
      },
    });

    logger.info({ chargeId: charge.id, encounterId, chargeCode }, "[billing/charge] line item added");
    res.json({ chargeId: charge.id, status: "pending" });
  } catch (err) {
    logger.error({ err }, "[billing/charge] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/billing/invoice/:encounterId -- generate invoice for pending charges
// ---------------------------------------------------------------------------
router.post("/api/billing/invoice/:encounterId", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { encounterId } = req.params;

  try {
    const supa = getSupabaseAdmin();

    // Fetch all pending charges for the encounter
    const { data: charges, error: fetchErr } = await supa
      .from("billing_charges")
      .select("*")
      .eq("encounter_id", encounterId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    if (!charges || charges.length === 0) {
      res.status(404).json({ error: "No pending charges found for this encounter" });
      return;
    }

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr =
      String(today.getFullYear()) +
      String(today.getMonth() + 1).padStart(2, "0") +
      String(today.getDate()).padStart(2, "0");

    // Count existing invoices for today to determine the sequential number
    const invoicePrefix = `INV-${dateStr}-`;
    const { count, error: countErr } = await supa
      .from("billing_charges")
      .select("invoice_number", { count: "exact", head: true })
      .like("invoice_number", `${invoicePrefix}%`)
      .neq("invoice_number", null as any);

    if (countErr) throw countErr;

    const seq = (count ?? 0) + 1;
    const invoiceNumber = `${invoicePrefix}${String(seq).padStart(4, "0")}`;
    const now = new Date().toISOString();

    // Update all pending charges with the invoice number
    const chargeIds = charges.map((c: any) => c.id);
    const { error: updateErr } = await supa
      .from("billing_charges")
      .update({
        status: "invoiced",
        invoice_number: invoiceNumber,
        invoiced_at: now,
      })
      .in("id", chargeIds);

    if (updateErr) throw updateErr;

    // Compute totals
    const lineItems = charges.map((c: any) => ({
      id: c.id,
      chargeCode: c.charge_code,
      chargeDescription: c.charge_description,
      category: c.category,
      quantity: c.quantity,
      unitPriceXcd: Number(c.unit_price_xcd),
      discountXcd: Number(c.discount_xcd),
      lineTotal: c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd),
    }));

    const totalXcd = lineItems.reduce((sum: number, li: any) => sum + li.lineTotal, 0);

    await audit({
      action: "book",
      entityType: "billing_invoice",
      entityId: invoiceNumber,
      payload: {
        encounter_id: encounterId,
        charge_count: charges.length,
        total_xcd: totalXcd,
      },
    });

    logger.info(
      { invoiceNumber, encounterId, chargeCount: charges.length, totalXcd },
      "[billing/invoice] invoice generated"
    );

    res.json({
      invoiceNumber,
      encounterId,
      lineItems,
      totalXcd,
      chargeCount: charges.length,
      invoicedAt: now,
    });
  } catch (err) {
    logger.error({ err }, "[billing/invoice] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/billing/payment/:invoiceNumber -- record payment for an invoice
// ---------------------------------------------------------------------------
router.post("/api/billing/payment/:invoiceNumber", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { invoiceNumber } = req.params;
  const { paymentMethod, notes } = req.body ?? {};

  const validMethods = ["cash", "card", "insurance", "transfer", "waived"];
  if (!paymentMethod || !validMethods.includes(paymentMethod)) {
    res.status(400).json({
      error: "Required: paymentMethod (cash | card | insurance | transfer | waived)",
    });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Verify there are invoiced charges with this invoice number
    const { data: charges, error: fetchErr } = await supa
      .from("billing_charges")
      .select("id, status")
      .eq("invoice_number", invoiceNumber)
      .eq("status", "invoiced");

    if (fetchErr) throw fetchErr;

    if (!charges || charges.length === 0) {
      res.status(404).json({ error: "No invoiced charges found for this invoice number" });
      return;
    }

    const now = new Date().toISOString();
    const chargeIds = charges.map((c: any) => c.id);

    const updatePayload: Record<string, unknown> = {
      status: "paid",
      paid_at: now,
      payment_method: paymentMethod,
    };
    if (notes) {
      updatePayload.notes = notes;
    }

    const { error: updateErr } = await supa
      .from("billing_charges")
      .update(updatePayload)
      .in("id", chargeIds);

    if (updateErr) throw updateErr;

    await audit({
      action: "book",
      entityType: "billing_payment",
      entityId: invoiceNumber,
      payload: {
        payment_method: paymentMethod,
        charge_count: charges.length,
      },
    });

    logger.info(
      { invoiceNumber, paymentMethod, chargeCount: charges.length },
      "[billing/payment] payment recorded"
    );

    res.json({
      invoiceNumber,
      status: "paid",
      paymentMethod,
      paidAt: now,
      chargeCount: charges.length,
    });
  } catch (err) {
    logger.error({ err }, "[billing/payment] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/encounter/:encounterId -- get all charges for an encounter
// ---------------------------------------------------------------------------
router.get("/api/billing/encounter/:encounterId", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { encounterId } = req.params;

  try {
    const supa = getSupabaseAdmin();

    const { data: charges, error } = await supa
      .from("billing_charges")
      .select("*")
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const items = (charges ?? []).map((c: any) => ({
      ...c,
      lineTotal: c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd),
    }));

    const subtotalXcd = items.reduce(
      (sum: number, c: any) => sum + c.quantity * Number(c.unit_price_xcd),
      0
    );
    const discountTotalXcd = items.reduce(
      (sum: number, c: any) => sum + Number(c.discount_xcd),
      0
    );
    const netTotalXcd = subtotalXcd - discountTotalXcd;

    res.json({
      encounterId,
      charges: items,
      subtotalXcd,
      discountTotalXcd,
      netTotalXcd,
    });
  } catch (err) {
    logger.error({ err }, "[billing/encounter] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/outstanding -- list all unpaid invoices
// ---------------------------------------------------------------------------
router.get("/api/billing/outstanding", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const supa = getSupabaseAdmin();

    const { data: charges, error } = await supa
      .from("billing_charges")
      .select("*")
      .eq("status", "invoiced")
      .not("invoice_number", "is", null)
      .order("invoiced_at", { ascending: false });

    if (error) throw error;

    // Group by invoice_number
    const invoiceMap = new Map<string, any[]>();
    for (const c of charges ?? []) {
      const inv = c.invoice_number as string;
      if (!invoiceMap.has(inv)) {
        invoiceMap.set(inv, []);
      }
      invoiceMap.get(inv)!.push(c);
    }

    const invoices = Array.from(invoiceMap.entries()).map(([invoiceNumber, items]) => {
      const totalXcd = items.reduce(
        (sum: number, c: any) => sum + c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd),
        0
      );
      return {
        invoiceNumber,
        encounterId: items[0].encounter_id,
        patientId: items[0].patient_id,
        invoicedAt: items[0].invoiced_at,
        chargeCount: items.length,
        totalXcd,
        charges: items,
      };
    });

    res.json({ invoices, totalOutstandingXcd: invoices.reduce((s, i) => s + i.totalXcd, 0) });
  } catch (err) {
    logger.error({ err }, "[billing/outstanding] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/daily-summary -- daily financial summary
// ---------------------------------------------------------------------------
router.get("/api/billing/daily-summary", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const supa = getSupabaseAdmin();

    // Compute today's date range in America/St_Lucia (UTC-4, no DST)
    const now = new Date();
    const offsetMs = 4 * 60 * 60 * 1000;
    const localDate = new Date(now.getTime() - offsetMs);
    const yyyy = localDate.getUTCFullYear();
    const mm = String(localDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(localDate.getUTCDate()).padStart(2, "0");
    const dayStartUtc = `${yyyy}-${mm}-${dd}T04:00:00.000Z`; // midnight AST = 04:00 UTC
    const dayEndUtc = `${yyyy}-${mm}-${dd}T28:00:00.000Z`;
    // Use proper next-day boundary
    const nextDay = new Date(`${yyyy}-${mm}-${dd}T04:00:00.000Z`);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayEndUtcStr = nextDay.toISOString();

    // Fetch all charges paid today
    const { data: paidToday, error: paidErr } = await supa
      .from("billing_charges")
      .select("*")
      .eq("status", "paid")
      .gte("paid_at", dayStartUtc)
      .lt("paid_at", dayEndUtcStr);

    if (paidErr) throw paidErr;

    // Fetch all outstanding (invoiced but not paid)
    const { data: outstanding, error: outErr } = await supa
      .from("billing_charges")
      .select("*")
      .eq("status", "invoiced");

    if (outErr) throw outErr;

    // Total collected today
    const totalCollectedXcd = (paidToday ?? []).reduce(
      (sum: number, c: any) => sum + c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd),
      0
    );

    // Total outstanding
    const totalOutstandingXcd = (outstanding ?? []).reduce(
      (sum: number, c: any) => sum + c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd),
      0
    );

    // Breakdown by category (today's payments)
    const byCategory: Record<string, number> = {};
    for (const c of paidToday ?? []) {
      const cat = c.category as string;
      const lineTotal = c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd);
      byCategory[cat] = (byCategory[cat] ?? 0) + lineTotal;
    }

    // Breakdown by payment method (today's payments)
    const byPaymentMethod: Record<string, number> = {};
    for (const c of paidToday ?? []) {
      const method = (c.payment_method as string) ?? "unknown";
      const lineTotal = c.quantity * Number(c.unit_price_xcd) - Number(c.discount_xcd);
      byPaymentMethod[method] = (byPaymentMethod[method] ?? 0) + lineTotal;
    }

    res.json({
      date: `${yyyy}-${mm}-${dd}`,
      totalCollectedXcd,
      totalOutstandingXcd,
      paidChargeCount: (paidToday ?? []).length,
      outstandingChargeCount: (outstanding ?? []).length,
      byCategory,
      byPaymentMethod,
    });
  } catch (err) {
    logger.error({ err }, "[billing/daily-summary] error");
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
