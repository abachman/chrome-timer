const { defineConfig, globalIgnores } = require("eslint/config")

module.exports = defineConfig([
  globalIgnores(["./**/jquery-1.8.3.min.js"]),
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        chrome: "readonly",
        chromeRuntimeGetContexts: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-console": "off",
    },
  },
  {
    // Turn off all rules that are unnecessary or might conflict with Prettier
    ...require("eslint-config-prettier"),
  },
])
