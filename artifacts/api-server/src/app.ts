import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import pinoHttp from "pino-http";
import path from "path";
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
app.use(helmet());
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
    // Vercel auto-generated preview slugs (word-word-word-NN.vercel.app)
    if (/^https:\/\/[a-z]{2,12}-[a-z]{2,12}-[a-z]{2,12}-\d{1,4}\.vercel\.app$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/booking', publicLimiter);
app.use('/api/patient/sms-code', smsLimiter);
app.use('/api/patient/request-consult', publicLimiter);

app.use(router);

app.all("/api/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

Sentry.setupExpressErrorHandler(app);

// Production: serve the built dashboard and fall back to index.html for SPA routing
if (process.env.NODE_ENV === "production") {
  const staticPath = path.resolve(__dirname, "../../dashboard/dist/public");
  app.use(express.static(staticPath));
  app.use((_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

export default app;
