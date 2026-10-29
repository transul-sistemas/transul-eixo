import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // O indicador do Next em desenvolvimento fica no canto inferior esquerdo e cobriria o botão de
  // recolher da barra lateral. Nos testes do Playwright (EIXO_TESTES=1) ele some, porque no celular
  // emulado cai sobre botões do topo; o pnpm dev normal não muda.
  devIndicators: process.env.EIXO_TESTES === "1" ? false : { position: "bottom-right" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
