import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * ESLint flat config.
 *
 * 2026-10-15: `eslint-config-next` was removed. It pulled an unpatchable
 * high-severity chain (braces <= 3.0.3, GHSA-vfj7-8cjw-p6xm — no fixed
 * version exists) via @next/eslint-plugin-next -> fast-glob -> micromatch
 * -> braces, which failed the `npm audit --audit-level=high` CI gate.
 * The config below keeps the two rule families that matter for this
 * codebase — typescript-eslint (was the core of eslint-config-next's
 * typescript preset) and react-hooks — without the Next.js plugin.
 */
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    // Matches the previous eslint-config-next behavior: unused vars are
    // warnings, not errors. (The recommended set has this as an error;
    // flipping ~100 pre-existing warnings to errors is separate tech debt.)
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  globalIgnores([
    // Default ignores previously provided by eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local backup dir (not real source):
    "node_modules.bak/**",
  ]),
]);

export default eslintConfig;
