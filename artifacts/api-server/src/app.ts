import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import pinoHttp from "pino-http";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const supabaseHost = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).host
  : 'nornhfzfrlmfzaqmrzzp.supabase.co';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: [
        "'self'",
        `https://${supabaseHost}`,
        'https://*.sentry.io',
        'https://www.googleapis.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(compression());

const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
  process.env.PORTAL_URL,
  process.env.DASHBOARD_URL,
  ...(isDev ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'] : []),
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // Vercel preview/production URLs for this project
    if (/^https:\/\/[\w-]+-amisesuite-afks-projects\.vercel\.app$/.test(origin)) return cb(null, true);
    if (/^https:\/\/amise[\w-]*\.vercel\.app$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Raw binary body for Tasker "File To Send" uploads (must run before router, only for this path)
app.use('/api/calls/recording-upload', (req, res, next) => {
  const ct = req.headers['content-type'] ?? '';
  if (!ct.includes('multipart/form-data') && !ct.includes('application/json') && !ct.includes('urlencoded')) {
    express.raw({ type: '*/*', limit: '50mb' })(req, res, next);
  } else {
    next();
  }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again in a few minutes, or call us at 284-0557.' },
});

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many code requests — please wait 15 minutes before trying again.' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.use('/api/booking', publicLimiter);
app.use('/api/patient/sms-code', smsLimiter);
app.use('/api/patient/request-consult', publicLimiter);
app.use('/api/whatsapp', webhookLimiter);

app.use(router);

app.all("/api/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

Sentry.setupExpressErrorHandler(app);

// Serve built dashboard if present (dev/monolith mode).
// In production the dashboard is deployed separately to Vercel, so this is skipped.
if (process.env.NODE_ENV === "production") {
  const staticPath = path.resolve(__dirname, "../../dashboard/dist/public");
  const indexHtml = path.join(staticPath, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(staticPath));
    app.use((_req, res) => res.sendFile(indexHtml));
  }
}

export default app;
