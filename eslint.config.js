import globals from "globals";

export default [
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
    },
    files: ["*.js"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
];
