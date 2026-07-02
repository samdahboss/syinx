// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      // Allow type assertions needed to silence deprecated API warnings
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow non-null assertions (we use them with tab.id! intentionally)
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".output/**",
      ".wxt/**",
      "postcss.config.js",
      "tailwind.config.ts",
      "vitest.config.ts",
      "scripts/**",
    ],
  },
);
