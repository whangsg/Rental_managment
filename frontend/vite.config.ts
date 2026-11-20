import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// /api 요청은 Flask(5000번 포트)로 전달한다. 같은 출처로 보이므로 CORS·세션 쿠키 문제가 없다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5000",
    },
  },
});
