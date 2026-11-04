import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rotaPublica } from "@/lib/seguranca/acesso";
import { CAMINHOS_DO_PROXY, CAMINHOS_DO_PROXY_TEXTO } from "@/lib/seguranca/caminhos-do-proxy";
import nextConfig from "@/next.config";

// O login (fatia 3.8), conferido sem subir o app: a configuração do Auth, toda rota do sistema
// protegida, nada de getSession nem de chave secreta no app, e os cabeçalhos de segurança.

const ler = (caminho: string) => readFileSync(caminho, "utf8");

function secao(toml: string, nome: string): string {
  const inicio = toml.indexOf(`\n[${nome}]\n`);
  if (inicio === -1) return "";
  const resto = toml.slice(inicio + nome.length + 4);
  const fim = resto.search(/\n\[/);
  return fim === -1 ? resto : resto.slice(0, fim);
}

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho.split("\\").join("/")];
  });
}

/** As rotas das páginas do grupo (sistema): app/(sistema)/frota/placas/[placa]/page.tsx → /frota/placas/X. */
function rotasDoSistema(): string[] {
  return arquivos("app/(sistema)")
    .filter((c) => c.endsWith("/page.tsx"))
    .map((c) =>
      c
        .replace(/^app\/\(sistema\)/, "")
        .replace(/\/page\.tsx$/, "")
        .replace(/\[[^\]]+\]/g, "ABC1D23")
        .replace(/\/\([^)]+\)/g, ""),
    )
    .map((r) => r || "/");
}

describe("configuração do Auth (supabase/config.toml)", () => {
  const toml = ler("supabase/config.toml");
  it("cadastro fechado: o usuário nasce no Studio", () => {
    expect(secao(toml, "auth")).toMatch(/^enable_signup = false$/m);
  });
  it("a entrada por e-mail continua ligada ([auth.email] enable_signup desligado desliga o login por e-mail)", () => {
    expect(secao(toml, "auth.email")).toMatch(/^enable_signup = true$/m);
  });
  it("senha com no mínimo 12 caracteres", () => {
    expect(secao(toml, "auth")).toMatch(/^minimum_password_length = 12$/m);
  });
  it("inatividade de 8 horas também no Auth local (o plano Free não tem; o app confere sozinho)", () => {
    expect(secao(toml, "auth.sessions")).toMatch(/^inactivity_timeout = "8h"$/m);
  });
  it("o e-mail de recuperação leva à confirmação do Eixo pelo token_hash (fluxo PKCE)", () => {
    expect(secao(toml, "auth.email.template.recovery")).toMatch(
      /content_path = "\.\/supabase\/templates\/recuperar-senha\.html"/,
    );
    const modelo = ler("supabase/templates/recuperar-senha.html");
    expect(modelo).toContain("{{ .RedirectTo }}");
    expect(modelo).toContain("token_hash={{ .TokenHash }}");
    expect(modelo).toContain("type=recovery");
  });
});

describe("rotas protegidas", () => {
  const rotas = rotasDoSistema();
  it("acha as telas do sistema", () => {
    expect(rotas.length).toBeGreaterThan(10);
    expect(rotas).toContain("/frota/placas");
  });
  it.each(rotas)("%s passa pelo proxy e não é pública", (rota) => {
    expect(rotaPublica(rota)).toBe(false);
    expect(CAMINHOS_DO_PROXY.test(rota), rota).toBe(true);
  });
  it("o proxy deixa de fora só os arquivos estáticos", () => {
    for (const estatico of [
      "/_next/static/x.js",
      "/_next/image",
      "/favicon.ico",
      "/icon.svg",
      "/fonts/barlow-400.woff2",
    ]) {
      expect(CAMINHOS_DO_PROXY.test(estatico), estatico).toBe(false);
    }
    for (const tela of ["/entrar", "/nova-senha", "/acesso-nao-liberado", "/auth/confirmar", "/"]) {
      expect(CAMINHOS_DO_PROXY.test(tela), tela).toBe(true);
    }
  });
  it("o proxy.ts usa exatamente esse filtro (o Next exige o literal no arquivo)", () => {
    const literal = /matcher:\s*\[\s*("(?:[^"\\]|\\.)*")\s*,?\s*\]/.exec(ler("proxy.ts"))?.[1];
    expect(literal).toBeDefined();
    expect(JSON.parse(literal as string)).toBe(CAMINHOS_DO_PROXY_TEXTO);
  });
});

describe("o app não confia no cookie cru nem conhece a chave secreta", () => {
  const codigo = ["app", "lib", "components"]
    .flatMap(arquivos)
    .concat(["proxy.ts"])
    .filter((c) => /\.(ts|tsx)$/.test(c) && !/\.test\.tsx?$/.test(c));
  it("ninguém usa getSession (o usuário vem do getUser, que valida no Auth)", () => {
    expect(codigo.filter((c) => /\.getSession\(/.test(ler(c)))).toEqual([]);
  });
  it("nenhuma chave secreta (service_role, SECRET_KEY, sb_secret_) em app/, lib/, components/ ou proxy.ts", () => {
    // A guarda das armadilhas cita os nomes para procurá-los.
    const semAGuarda = codigo.filter((c) => !c.startsWith("lib/qualidade/armadilhas"));
    expect(semAGuarda.filter((c) => /service_role|SECRET_KEY|sb_secret_/i.test(ler(c)))).toEqual(
      [],
    );
  });
});

describe("cabeçalhos de segurança e origem das Server Actions (next.config.ts)", () => {
  it("cabeçalhos em todas as rotas", async () => {
    const regras = await nextConfig.headers!();
    const todas = regras.find((r) => r.source === "/:path*");
    const mapa = Object.fromEntries((todas?.headers ?? []).map((h) => [h.key, h.value]));
    expect(mapa["X-Frame-Options"]).toBe("DENY");
    expect(mapa["X-Content-Type-Options"]).toBe("nosniff");
    expect(mapa["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(mapa["Permissions-Policy"]).toContain("camera=()");
    expect(mapa["Strict-Transport-Security"]).toContain("max-age=");
  });
  it("as Server Actions só aceitam a própria origem (o Next confere Origin × Host; ninguém alarga a lista)", () => {
    expect(nextConfig.experimental?.serverActions?.allowedOrigins).toBeUndefined();
  });
});
