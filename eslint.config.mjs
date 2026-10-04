import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".next", "output"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    languageOptions: { ecmaVersion: 2022 },
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: { globals: { console: "readonly" } },
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        URL: "readonly",
        fetch: "readonly",
        Response: "readonly",
      },
    },
  },
);
