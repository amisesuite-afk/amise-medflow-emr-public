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

// ---------------------------------------------------------------------------
// POST /api/billing/save-and-invoice/:encounterId
// Batch-insert line items for an encounter and immediately generate an invoice.
// Body: { patientId, lines: [{ chargeCode, chargeDescription, quantity,
//         unitPriceXcd, discountXcd, category, notes? }], notes?: string }
// ---------------------------------------------------------------------------
router.post("/api/billing/save-and-invoice/:encounterId", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { encounterId } = req.params;
  const { patientId, lines, notes: invoiceNotes } = req.body ?? {};

  if (!patientId || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: "Required: patientId and lines (non-empty array)" });
    return;
  }

  for (const l of lines) {
    if (!l.chargeCode || !l.chargeDescription || l.unitPriceXcd == null || !l.category) {
      res.status(400).json({
        error: "Each line requires: chargeCode, chargeDescription, unitPriceXcd, category",
      });
      return;
    }
  }

  try {
    const supa = getSupabaseAdmin();

    // 1. Insert all line items as pending
    const insertPayload = (lines as any[]).map((l) => ({
      encounter_id:       encounterId,
      patient_id:         patientId,
      charge_code:        l.chargeCode,
      charge_description: l.chargeDescription,
      unit_price_xcd:     Number(l.unitPriceXcd),
      discount_xcd:       Number(l.discountXcd ?? 0),
      quantity:           Number(l.quantity ?? 1),
      category:           l.category,
      notes:              l.notes ?? invoiceNotes ?? null,
      status:             "pending",
    }));

    const { data: inserted, error: insertErr } = await supa
      .from("billing_charges")
      .insert(insertPayload)
      .select("id");

    if (insertErr) throw insertErr;
    if (!inserted || inserted.length === 0) throw new Error("Insert returned no rows");

    // 2. Generate invoice number: INV-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr =
      String(today.getFullYear()) +
      String(today.getMonth() + 1).padStart(2, "0") +
      String(today.getDate()).padStart(2, "0");

    const invoicePrefix = `INV-${dateStr}-`;
    const { count, error: countErr } = await supa
      .from("billing_charges")
      .select("invoice_number", { count: "exact", head: true })
      .like("invoice_number", `${invoicePrefix}%`)
      .not("invoice_number", "is", null);

    if (countErr) throw countErr;

    const seq = (count ?? 0) + 1;
    const invoiceNumber = `${invoicePrefix}${String(seq).padStart(4, "0")}`;
    const now = new Date().toISOString();

    const chargeIds = inserted.map((c: any) => c.id);

    const { error: updateErr } = await supa
      .from("billing_charges")
      .update({ status: "invoiced", invoice_number: invoiceNumber, invoiced_at: now })
      .in("id", chargeIds);

    if (updateErr) throw updateErr;

    // 3. Compute totals for response
    const lineItems = (lines as any[]).map((l, i) => {
      const qty     = Number(l.quantity ?? 1);
      const unit    = Number(l.unitPriceXcd);
      const disc    = Number(l.discountXcd ?? 0);
      return {
        id:                chargeIds[i]?.id ?? chargeIds[i],
        chargeCode:        l.chargeCode,
        chargeDescription: l.chargeDescription,
        category:          l.category,
        quantity:          qty,
        unitPriceXcd:      unit,
        discountXcd:       disc,
        lineTotal:         qty * unit - disc,
      };
    });

    const totalXcd = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);

    await audit({
      action:     "book",
      entityType: "billing_invoice",
      entityId:   invoiceNumber,
      payload:    { encounter_id: encounterId, charge_count: lines.length, total_xcd: totalXcd },
    });

    logger.info({ invoiceNumber, encounterId, chargeCount: lines.length, totalXcd }, "[billing/save-and-invoice] done");

    res.json({ invoiceNumber, encounterId, lineItems, totalXcd, chargeCount: lineItems.length, invoicedAt: now });
  } catch (err) {
    logger.error({ err }, "[billing/save-and-invoice] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/receipt/:invoiceNumber
// Returns a self-contained HTML receipt for the given invoice.
// ---------------------------------------------------------------------------
router.get("/api/billing/receipt/:invoiceNumber", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { invoiceNumber } = req.params;

  try {
    const supa = getSupabaseAdmin();

    const { data: charges, error: fetchErr } = await supa
      .from("billing_charges")
      .select("*")
      .eq("invoice_number", invoiceNumber)
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    if (!charges || charges.length === 0) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const firstCharge = charges[0] as any;
    const patientId   = firstCharge.patient_id as string;

    // Fetch patient name
    const { data: patient } = await supa
      .from("patients")
      .select("first_name, last_name, date_of_birth")
      .eq("id", patientId)
      .maybeSingle();

    const patientName  = patient
      ? `${(patient as any).first_name ?? ""} ${(patient as any).last_name ?? ""}`.trim()
      : "Unknown Patient";

    const invoicedAt   = firstCharge.invoiced_at as string | null;
    const paidAt       = firstCharge.paid_at     as string | null;
    const paymentMethod = firstCharge.payment_method as string | null;
    const invoiceDate  = invoicedAt
      ? new Date(invoicedAt).toLocaleDateString("en-LC", { timeZone: "America/St_Lucia", day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-LC", { timeZone: "America/St_Lucia", day: "2-digit", month: "long", year: "numeric" });

    const lineItems = (charges as any[]).map((c) => ({
      code:        c.charge_code    as string,
      description: c.charge_description as string,
      category:    c.category       as string,
      qty:         Number(c.quantity),
      unit:        Number(c.unit_price_xcd),
      disc:        Number(c.discount_xcd),
      total:       Number(c.quantity) * Number(c.unit_price_xcd) - Number(c.discount_xcd),
    }));

    const subtotal    = lineItems.reduce((s, l) => s + l.qty * l.unit, 0);
    const discTotal   = lineItems.reduce((s, l) => s + l.disc, 0);
    const grandTotal  = subtotal - discTotal;
    const isPaid      = (charges as any[]).every((c) => c.status === "paid");

    const fmt = (n: number) =>
      n.toLocaleString("en-LC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rows = lineItems
      .map(
        (l) => `
      <tr>
        <td>${l.code}</td>
        <td>${l.description}</td>
        <td class="num">${l.qty}</td>
        <td class="num">$${fmt(l.unit)}</td>
        <td class="num">${l.disc > 0 ? `-$${fmt(l.disc)}` : "—"}</td>
        <td class="num">$${fmt(l.total)}</td>
      </tr>`
      )
      .join("");

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Receipt ${invoiceNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  .practice h1{font-size:18px;font-weight:700;color:#1a4a6e}
  .practice p{font-size:11px;color:#555;line-height:1.6}
  .invoice-meta{text-align:right;font-size:12px;line-height:1.7}
  .invoice-meta .inv-no{font-size:16px;font-weight:700;color:#1a4a6e}
  .status-badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;
    background:${isPaid ? "#d1fae5" : "#fef3c7"};color:${isPaid ? "#065f46" : "#92400e"};margin-top:4px}
  .patient-box{background:#f7f9fc;border:1px solid #dde3ec;border-radius:6px;padding:12px 16px;margin-bottom:20px}
  .patient-box h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px}
  .patient-box p{font-size:13px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead th{background:#1a4a6e;color:#fff;font-size:11px;text-transform:uppercase;
    letter-spacing:.06em;padding:7px 10px;text-align:left}
  thead th.num{text-align:right}
  tbody tr:nth-child(even){background:#f7f9fc}
  tbody td{padding:6px 10px;border-bottom:1px solid #e8ecf1;vertical-align:top}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .totals{margin-left:auto;width:260px}
  .totals tr td{padding:4px 10px}
  .totals tr.grand td{font-weight:700;font-size:14px;border-top:2px solid #1a4a6e;padding-top:6px}
  .payment-info{margin-top:16px;font-size:12px;color:#555;border-top:1px solid #e8ecf1;padding-top:12px}
  .footer{margin-top:28px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e8ecf1;padding-top:12px}
  @media print{body{padding:16px}button{display:none}}
</style>
</head>
<body>
<div class="header">
  <div class="practice">
    <h1>Amise Medical Services</h1>
    <p>Surgical &amp; Endoscopic Practice<br>
    Dr Dawit Daniel Kabiye MD DM<br>
    Tapion Hospital · Rodney Bay Medical Centre<br>
    Saint Lucia, West Indies<br>
    Tel: +1 (758) 284-0557</p>
  </div>
  <div class="invoice-meta">
    <div class="inv-no">${invoiceNumber}</div>
    <div>Date: ${invoiceDate}</div>
    ${paidAt ? `<div>Paid: ${new Date(paidAt).toLocaleDateString("en-LC", { timeZone: "America/St_Lucia", day: "2-digit", month: "long", year: "numeric" })}</div>` : ""}
    <div><span class="status-badge">${isPaid ? "PAID" : "INVOICED"}</span></div>
  </div>
</div>

<div class="patient-box">
  <h2>Patient</h2>
  <p>${patientName}</p>
</div>

<table>
  <thead>
    <tr>
      <th>Code</th><th>Description</th>
      <th class="num">Qty</th><th class="num">Unit (XCD)</th>
      <th class="num">Discount</th><th class="num">Total (XCD)</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<table class="totals">
  <tbody>
    <tr><td>Subtotal</td><td class="num">$${fmt(subtotal)}</td></tr>
    ${discTotal > 0 ? `<tr><td>Discount</td><td class="num">-$${fmt(discTotal)}</td></tr>` : ""}
    <tr class="grand"><td>Total (XCD)</td><td class="num">$${fmt(grandTotal)}</td></tr>
  </tbody>
</table>

${isPaid && paymentMethod ? `<div class="payment-info">Payment received via <strong>${paymentMethod}</strong>. Thank you.</div>` : ""}

<div class="footer">
  This receipt was generated by Amise MedFlow EMR. For billing enquiries contact the practice directly.<br>
  Prices are in Eastern Caribbean Dollars (XCD). © Amise Medical Services.
</div>
</body>
</html>`;

    logger.info({ invoiceNumber }, "[billing/receipt] generated");
    res.json({ receiptHtml });
  } catch (err) {
    logger.error({ err }, "[billing/receipt] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/billing/charge/:id -- edit a pending charge
// ---------------------------------------------------------------------------
router.patch("/api/billing/charge/:id", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { chargeDescription, quantity, unitPriceXcd, discountXcd, notes } = req.body ?? {};

  try {
    const supa = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supa
      .from("billing_charges").select("id, status").eq("id", id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: "Charge not found" }); return; }
    if ((existing as Record<string, unknown>).status !== "pending") {
      res.status(400).json({ error: "Only pending charges can be edited" }); return;
    }

    const patch: Record<string, unknown> = {};
    if (chargeDescription !== undefined) patch.charge_description = chargeDescription;
    if (quantity !== undefined)           patch.quantity           = Number(quantity);
    if (unitPriceXcd !== undefined)       patch.unit_price_xcd    = Number(unitPriceXcd);
    if (discountXcd !== undefined)        patch.discount_xcd      = Number(discountXcd);
    if (notes !== undefined)              patch.notes             = notes || null;

    if (!Object.keys(patch).length) { res.status(400).json({ error: "No updatable fields provided" }); return; }

    const { error: updateErr } = await supa.from("billing_charges").update(patch).eq("id", id);
    if (updateErr) throw updateErr;

    await audit({ action: "change_request", entityType: "billing_charge", entityId: id, payload: patch });
    logger.info({ id }, "[billing/charge-patch] updated");
    res.json({ id, ...patch });
  } catch (err) {
    logger.error({ err }, "[billing/charge-patch] error");
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/billing/charge/:id/void -- void a charge
// ---------------------------------------------------------------------------
router.post("/api/billing/charge/:id/void", async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  try {
    const supa = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supa
      .from("billing_charges").select("id, status").eq("id", id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: "Charge not found" }); return; }

    const status = (existing as Record<string, unknown>).status as string;
    if (status === "paid")  { res.status(400).json({ error: "Paid charges cannot be voided" }); return; }
    if (status === "void")  { res.status(400).json({ error: "Charge is already voided" }); return; }

    const { error: updateErr } = await supa.from("billing_charges").update({ status: "void" }).eq("id", id);
    if (updateErr) throw updateErr;

    await audit({ action: "change_request", entityType: "billing_charge", entityId: id, payload: { status: "void" } });
    logger.info({ id }, "[billing/charge-void] voided");
    res.json({ id, status: "void" });
  } catch (err) {
    logger.error({ err }, "[billing/charge-void] error");
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
