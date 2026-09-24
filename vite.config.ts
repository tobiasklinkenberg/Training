/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Basis-Pfad: auf GitHub Pages liegt die App unter /<repo>/ — wird im
// Deploy-Workflow über BASE_PATH gesetzt. Lokal: "/".
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.svg", "icons/*.png"],
      manifest: {
        name: "Trainingssteuerung",
        short_name: "Training",
        description: "Tennis, Laufen, Kraft erfassen — Wochenvorschlag mit Claude.",
        lang: "de",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b1220",
        theme_color: "#0b1220",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Supabase-Aufrufe nie cachen — Daten kommen aus TanStack Query + IndexedDB-Puffer.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: { target: "es2020", sourcemap: false },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
