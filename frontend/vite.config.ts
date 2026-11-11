
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        "/prometheus": {
          target: "http://localhost:9090",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/prometheus/, ""),
        },
      },
    },
  },
});
