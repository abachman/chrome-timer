const standardFlatConfig = require('eslint-config-standard-flat')
const { defineConfig, globalIgnores } = require('eslint/config')

module.exports = defineConfig([
  standardFlatConfig.default,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  globalIgnores(['./**/jquery-1.8.3.min.js'])
])
