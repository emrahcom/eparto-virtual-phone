export default [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        browser: "readonly",
      },
    },
    rules: {
      indent: ["error", 2],
      "no-constant-binary-expression": "error",
      "no-extra-boolean-cast": "error",
      "no-undef": "error",
      "no-unused-vars": "error",
      "object-curly-spacing": ["error", "always"],
    },
  },
];
