// Cor hexadecimal em CSS só no arquivo de tokens (criado na Fase 2). Ver docs/decisoes.md.
const configuracao = {
  rules: { "color-no-hex": true },
  ignoreFiles: [
    "node_modules/**",
    ".next/**",
    ".agents/**",
    ".claude/**",
    "coverage/**",
    "playwright-report/**",
  ],
  overrides: [{ files: ["app/tokens.css"], rules: { "color-no-hex": null } }],
};

export default configuracao;
