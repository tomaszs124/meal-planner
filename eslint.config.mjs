import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Project guardrails
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Browser dialogs block the UI and cannot be styled; use useFeedback() from components/ui/Feedback.
      "no-restricted-globals": [
        "error",
        { name: "alert", message: "Use toast() from useFeedback() instead of alert()." },
        { name: "confirm", message: "Use confirm() from useFeedback() instead of window.confirm()." },
        { name: "prompt", message: "Build a small form/dialog instead of prompt()." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "alert", message: "Use toast() from useFeedback()." },
        { object: "window", property: "confirm", message: "Use confirm() from useFeedback()." },
      ],
      // Keep debug output out of production code; console.error/warn stay allowed until a logger exists.
      "no-console": ["error", { allow: ["error", "warn"] }],
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
