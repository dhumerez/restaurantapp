import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    TanStackRouterVite(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      manifest: {
        name: "Tu Restaurante",
        short_name: "Restaurante",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#08090e",
        background_color: "#08090e",
        start_url: ".",
        lang: "es",
        icons: [
          { src: "icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3000",
        ws: true,
      },
    },
  },
});
