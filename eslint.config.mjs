import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pictures come from the database (base64 / cached /api/img links), not static files,
      // so next/image's optimiser doesn't apply.
      "@next/next/no-img-element": "off",
      // Deliberate pattern here: read browser-only things (localStorage, theme, permissions)
      // after the page mounts, and fill an edit form once its data arrives.
      "react-hooks/set-state-in-effect": "off",
      // "Latest callback in a ref" pattern (AdCard) is intentional.
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
