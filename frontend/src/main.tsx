import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles/app.css";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/ui";
import { InstallApp } from "./components/InstallApp";
import { startOfflineSync } from "./lib/offlineReports";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
          <InstallApp />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Field reports saved without signal are sent when the connection returns.
startOfflineSync();

// Installable app (add to home screen); only in production builds, so development is never served from a worker.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
