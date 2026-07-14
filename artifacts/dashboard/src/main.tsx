import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Guard for browsers (iOS Safari < 16.4) that don't support the Notifications API
if (typeof (window as unknown as Record<string, unknown>).Notification === 'undefined') {
  (window as unknown as Record<string, unknown>).Notification = {
    permission: 'denied' as NotificationPermission,
    requestPermission: () => Promise.resolve('denied' as NotificationPermission),
  };
}

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.2 });
}

createRoot(document.getElementById("root")!).render(<App />);
