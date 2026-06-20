import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // Relaxed TypeScript rules for a fast-moving dashboard project
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-non-null-assertion": "off",

    // Relaxed React rules
    "react-hooks/exhaustive-deps": "warn",
    "react/no-unescaped-entities": "off",
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;