import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // O indicador do Next em desenvolvimento fica no canto inferior esquerdo e cobriria o botão de
  // recolher da barra lateral. Nos testes do Playwright (EIXO_TESTES=1) ele some, porque no celular
  // emulado cai sobre botões do topo; o pnpm dev normal não muda.
  devIndicators: process.env.EIXO_TESTES === "1" ? false : { position: "bottom-right" },
  // Cabeçalhos de segurança em todas as rotas (fatia 3.8). As Server Actions só aceitam a própria
  // origem: o Next confere Origin × Host, e ninguém alarga a lista (serverActions.allowedOrigins).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
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
