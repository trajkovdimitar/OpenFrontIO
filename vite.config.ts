import { execSync } from "child_process";
import { resolve } from "path";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

// Vite already handles these, but its good practice to define them explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let gitCommit = process.env.GIT_COMMIT;

if (!gitCommit) {
  try {
    gitCommit = execSync("git rev-parse HEAD").toString().trim();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Unable to determine git commit:", error.message);
    }
    gitCommit = "unknown";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProduction = mode === "production";

  return {
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
    },
    root: "./",
    base: "/",
    publicDir: "resources", // Access static assets via import or explicit copy

    resolve: {
      alias: {
        "protobufjs/minimal": path.resolve(
          __dirname,
          "node_modules/protobufjs/minimal.js",
        ),
        resources: path.resolve(__dirname, "resources"),
      },
    },

    plugins: [
      tsconfigPaths(),
      createHtmlPlugin({
        minify: isProduction,
        pages: [
          {
            entry: "/src/client/Main.ts",
            filename: "index.html",
            template: "index.html",
            injectOptions: {
              data: {
                // In case we need to inject variables into HTML
              },
            },
          },
          {
            entry: "/src/client/Demo3D.ts",
            filename: "demo-3d.html",
            template: "demo-3d.html",
            injectOptions: {
              data: {},
            },
          },
        ],
      }),
      viteStaticCopy({
        targets: [
          {
            src: "proprietary/*",
            dest: ".",
          },
        ],
      }),
    ],

    define: {
      "process.env.WEBSOCKET_URL": JSON.stringify(
        isProduction ? "" : "localhost:3000",
      ),
      "process.env.GAME_ENV": JSON.stringify(isProduction ? "prod" : "dev"),
      "process.env.GIT_COMMIT": JSON.stringify(gitCommit),
      "process.env.STRIPE_PUBLISHABLE_KEY": JSON.stringify(
        env.STRIPE_PUBLISHABLE_KEY,
      ),
      "process.env.API_DOMAIN": JSON.stringify(env.API_DOMAIN),
      // Add other process.env variables if needed, OR migrate code to import.meta.env
    },

    build: {
      outDir: "static", // Webpack outputs to 'static', assuming we want to keep this.
      emptyOutDir: true,
      assetsDir: "assets", // Sub-directory for assets
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          "demo-3d": resolve(__dirname, "demo-3d.html"),
        },
        output: {
          manualChunks(id) {
            // Vendor chunks for main app
            if (id.includes("node_modules/pixi.js")) return "vendor";
            if (id.includes("node_modules/howler")) return "vendor";
            if (id.includes("node_modules/zod")) return "vendor";
            if (id.includes("node_modules/protobufjs")) return "vendor";
            // Three.js chunk for 3D demo
            if (id.includes("node_modules/three")) return "three";
          },
        },
      },
    },

    server: {
      port: 9000,
      // Automatically open the browser when the server starts
      open: process.env.SKIP_BROWSER_OPEN !== "true",
      proxy: {
        "/lobbies": {
          target: "ws://localhost:3000",
          ws: true,
          changeOrigin: true,
        },
        // Worker proxies
        "/w0": {
          target: "ws://localhost:3001",
          ws: true,
          secure: false,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/w0/, ""),
        },
        "/w1": {
          target: "ws://localhost:3002",
          ws: true,
          secure: false,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/w1/, ""),
        },
        "/w2": {
          target: "ws://localhost:3003",
          ws: true,
          secure: false,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/w2/, ""),
        },
        // API proxies
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
