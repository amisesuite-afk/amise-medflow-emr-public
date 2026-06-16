import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

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

const allowedOrigins = [
  process.env.PORTAL_URL,
  process.env.DASHBOARD_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin) and whitelisted origins
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(router);

// Production: serve the built dashboard and fall back to index.html for SPA routing
if (process.env.NODE_ENV === "production") {
  const staticPath = path.resolve(__dirname, "../../dashboard/dist/public");
  app.use(express.static(staticPath));
  app.use((_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

export default app;
