import standardFlatConfig from 'eslint-config-standard-flat'

export default [
  standardFlatConfig.default,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  }
]
