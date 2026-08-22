import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },

      // adapter-vercel targets Vercel's Node.js runtime (docs/deployment.md).
      // See https://svelte.dev/docs/kit/adapters for more information about adapters.
      // Pin the serverless runtime explicitly — building under Bun makes
      // version auto-detection unreliable (docs/deployment.md).
      adapter: adapter({ runtime: "nodejs22.x" }),

      // CSP is managed here (not in hooks) so SvelteKit can hash its own
      // inline hydration bootstrap into script-src automatically. Hash mode,
      // not nonce: deterministic per build and safe to cache (docs/security.md).
      csp: {
        mode: "hash",
        directives: {
          "default-src": ["self"],
          "script-src": ["self"],
          "style-src": ["self", "unsafe-inline"],
          "img-src": ["self", "data:"],
          "connect-src": ["self"],
          "frame-ancestors": ["none"],
          "form-action": ["self"],
          "base-uri": ["none"],
        },
      },
    }),
  ],
});
