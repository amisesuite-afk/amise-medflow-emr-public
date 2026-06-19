import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { requireCronSecret } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/api/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/api/healthz/env", (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const check = (key: string) => !!process.env[key];
  const mode = process.env.MODE || 'dry_run';
  const smsProvider = process.env.SMS_PROVIDER || 'dry_run';

  res.json({
    mode,
    smsProvider,
    services: {
      supabase:   { url: check('SUPABASE_URL'), serviceKey: check('SUPABASE_SERVICE_ROLE_KEY') },
      anthropic:  { apiKey: check('ANTHROPIC_API_KEY') },
      google:     { oauthClient: check('GOOGLE_OAUTH_CLIENT_ID'), oauthSecret: check('GOOGLE_OAUTH_CLIENT_SECRET'), refreshToken: check('GOOGLE_OAUTH_REFRESH_TOKEN'), serviceAccount: check('GOOGLE_SERVICE_ACCOUNT_JSON') },
      gmail:      { user: process.env.GMAIL_USER || '(not set)' },
      calendars:  { rodneyBay: check('CALENDAR_ID_RODNEY_BAY'), castries: check('CALENDAR_ID_CASTRIES'), tapionErcp: check('CALENDAR_ID_TAPION_ERCP') },
      twilio:     { sid: check('TWILIO_ACCOUNT_SID'), authToken: check('TWILIO_AUTH_TOKEN'), fromNumber: check('TWILIO_FROM_NUMBER') },
      notify:     { staffPhone: check('STAFF_NOTIFY_PHONE'), staffEmail: check('STAFF_NOTIFY_EMAIL'), doctorEmail: check('DOCTOR_NOTIFY_EMAIL') },
      portal:     { url: process.env.PORTAL_URL || '(not set)', dashboardUrl: process.env.DASHBOARD_URL || '(not set)' },
      cron:       { secret: check('CRON_SECRET') },
    },
  });
});

export default router;
