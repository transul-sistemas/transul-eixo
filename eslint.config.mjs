import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const HEX = "/^#[0-9a-fA-F]{3,8}$/";

// Formato de cor e de número só existe em components/formato/ (regra inviolável 6 do CLAUDE.md).
const regrasDeFormato = {
  "no-restricted-syntax": [
    "error",
    {
      selector: `Literal[value=${HEX}]`,
      message: "Cor hexadecimal fora de components/formato/. Use os tokens do sistema visual.",
    },
    {
      selector: `TemplateElement[value.raw=${HEX}]`,
      message: "Cor hexadecimal fora de components/formato/. Use os tokens do sistema visual.",
    },
    {
      selector: "CallExpression[callee.property.name='toLocaleString']",
      message:
        "toLocaleString fora de components/formato/. Use o componente de formato (moeda, data, km...).",
    },
    {
      selector: "CallExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
      message:
        "Intl.NumberFormat fora de components/formato/. Use o componente de formato (moeda, data, km...).",
    },
    {
      selector: "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
      message:
        "Intl.NumberFormat fora de components/formato/. Use o componente de formato (moeda, data, km...).",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: regrasDeFormato },
  { files: ["components/formato/**"], rules: { "no-restricted-syntax": "off" } },
  prettier,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Fora do alcance das regras do app:
    ".agents/**",
    ".claude/**",
    "supabase/**",
    "workers/**",
    "importacao/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
