import globals from "globals";

export default [
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "no-console": ["warn", { allow: ["error", "warn", "info"] }],
      "prefer-const": "warn",
      "no-var": "warn",
      eqeqeq: ["warn", "always"],
      curly: ["warn", "all"],
      indent: ["warn", 2],
      quotes: ["warn", "double"],
      semi: ["warn", "always"],
      "space-before-blocks": "warn",
      "space-before-function-paren": [
        "warn",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always",
        },
      ],
      "space-in-parens": ["warn", "never"],
      "space-infix-ops": "warn",
      "keyword-spacing": "warn",
      "comma-spacing": ["warn", { before: false, after: true }],
      "no-multiple-empty-lines": ["warn", { max: 1, maxEOF: 0 }],
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
    ignores: ["dist/", "node_modules/", "docs/"],
  },
];
