import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      "warehouse-breezy.local",
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_PROXY_TARGET || "http://backend:8000",
        changeOrigin: true,
      },
      "/uploads": {
        target: process.env.VITE_DEV_PROXY_TARGET || "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});