import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Hex como texto inteiro ("#FF7A3D") ou embutido em texto maior. Embutido, o hex vem depois de
// "[", "(", ":" ou "," (bg-[#FF7A3D], color:#fff, gradient(#fff)); depois de espaço só conta se
// tiver letra de a a f ("1px solid #fff"), para não barrar "Pedido #1234".
const HEX_TEXTO_INTEIRO = String.raw`^#[0-9a-fA-F]{3,8}$`;
const HEX_EMBUTIDO = String.raw`[\[(:,]\s*#[0-9a-fA-F]{3,8}\b`;
const HEX_EMBUTIDO_APOS_ESPACO = String.raw`\s#(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{3,8}\b`;
const HEX = `/(${HEX_TEXTO_INTEIRO})|(${HEX_EMBUTIDO})|(${HEX_EMBUTIDO_APOS_ESPACO})/`;

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
  // O teste das regras precisa de hex e toLocaleString como texto de exemplo.
  { files: ["lib/qualidade/regras-lint.test.ts"], rules: { "no-restricted-syntax": "off" } },
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
