export default [
  {
    ignores: ['node_modules', 'dist']
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      sourceType: 'module'
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  }
];
