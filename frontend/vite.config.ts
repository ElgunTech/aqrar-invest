import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite on :5173 proxies the API to Spring Boot on :8080.
// Build: output goes straight into Spring Boot's static folder, so one JAR serves everything.
const backend = "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/mock-mygov": backend,
      "/v3": backend,
      "/swagger-ui": backend,
      "/swagger-ui.html": backend,
    },
  },
  build: {
    // Vercel hosts the SPA on its own; locally the build goes into the Spring Boot JAR
    outDir: process.env.VERCEL ? "dist" : "../backend/src/main/resources/static",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});
