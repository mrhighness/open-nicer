// Nicle Inc vite-tanstack-config already includes the following — do NOT add them manually

// or the app will break with duplicate plugins:

//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),

//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,

//     error logger plugins, and sandbox detection (port/host/strictPort).

// You can pass additional config via defineConfig({ vite: { ... } }) if needed.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

import { getSecurityHeaders } from "./src/lib/security/headers";



const supabaseOrigin = process.env.VITE_SUPABASE_URL

  ? new URL(process.env.VITE_SUPABASE_URL).origin

  : undefined;



const deepaiKey = process.env.DEEPAI_API_KEY || process.env.VITE_DEEPAI_API_KEY;

const pixazoKey = process.env.PIXAZO_API_KEY || process.env.VITE_PIXAZO_API_KEY;



const pixazoModel = process.env.PIXAZO_MODEL || process.env.VITE_PIXAZO_MODEL || "nano-banana-2";



const proxy: Record<string, import("vite").ProxyOptions> = {};



if (deepaiKey) {

  proxy["/api/deepai"] = {

    target: "https://api.deepai.org/api",

    changeOrigin: true,

    rewrite: (path) => path.replace(/^\/api\/deepai/, ""),

    configure: (p) => {

      p.on("proxyReq", (proxyReq) => {

        proxyReq.setHeader("api-key", deepaiKey);

      });

    },

  };

}



if (pixazoKey) {

  proxy["/api/pixazo"] = {

    target: "https://gateway.pixazo.ai",

    changeOrigin: true,

    rewrite: (path) => {

      const rest = path.replace(/^\/api\/pixazo/, "") || "";

      if (rest === "/generate") return `/${pixazoModel}/v1/${pixazoModel}/generate`;

      if (rest.startsWith("/status/")) return `/v2/requests${rest}`;

      return rest;

    },

    configure: (p) => {

      p.on("proxyReq", (proxyReq) => {

        proxyReq.setHeader("Ocp-Apim-Subscription-Key", pixazoKey);

      });

    },

  };

}



export default defineConfig({

  vite: {

    server: {

      headers: getSecurityHeaders(supabaseOrigin),

      proxy: Object.keys(proxy).length ? proxy : undefined,

    },

  },

});

