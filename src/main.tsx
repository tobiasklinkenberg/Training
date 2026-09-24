import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";

// Service Worker: App-Shell wird vorab gecacht; neue Version beim nächsten Online-Start.
if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
