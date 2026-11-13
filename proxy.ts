import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { CHAVE_DA_FAIXA } from "@/lib/dados/faixa-da-demonstracao";
import { acharTela } from "@/lib/navegacao/catalogo";
import { decidirFicha } from "@/lib/navegacao/proxy-da-ficha";
import { ehTelaEmTeste } from "@/lib/navegacao/visibilidade";
import { type Decisao, decidirAcesso, moduloDoCaminho, rotaPublica } from "@/lib/seguranca/acesso";
import { perfilDoCodigo } from "@/lib/seguranca/sessao";
import {
  COOKIE_DE_ATIVIDADE,
  expirouPorInatividade,
  lerUltimaAtividade,
} from "@/lib/seguranca/inatividade";
import { configuracaoDoSupabase } from "@/lib/supabase/configuracao";
import { opcoesDoCookie } from "@/lib/supabase/cookies";

// O proxy, a cada pedido (fatia 3.8):
//  * a ficha da placa mal escrita vira 404 de verdade antes de a rota renderizar;
//  * renova a sessão do Supabase (getUser valida no Auth) e grava o cookie renovado;
//  * confere a inatividade de 8 horas (o plano Free não tem o limite; é do app);
//  * lê do banco, com a chave do usuário, o vínculo (config.perfil_atual) e se ele pode ver o módulo
//    do caminho (config.pode): rebaixar o papel tira o acesso no pedido seguinte.
// Cada página e cada Server Action confere de novo no servidor; o proxy não é a única barreira.
export async function proxy(pedido: NextRequest) {
  const caminho = pedido.nextUrl.pathname;
  if (decidirFicha(caminho) === "nao-encontrada") {
    return NextResponse.rewrite(new URL("/nao-encontrada", pedido.url), { status: 404 });
  }

  let resposta = NextResponse.next({ request: pedido });
  const cabecalhosDeCache: Record<string, string> = {};
  const { url, chave } = configuracaoDoSupabase();
  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => pedido.cookies.getAll(),
      setAll: (lista, cabecalhos) => {
        for (const { name, value } of lista) pedido.cookies.set(name, value);
        resposta = NextResponse.next({ request: pedido });
        for (const { name, value, options } of lista)
          resposta.cookies.set(name, value, opcoesDoCookie(options));
        Object.assign(cabecalhosDeCache, cabecalhos);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const usuario = data.user;
  const agora = Date.now();
  const inativo =
    usuario !== null &&
    expirouPorInatividade(
      lerUltimaAtividade(pedido.cookies.get(COOKIE_DE_ATIVIDADE)?.value),
      agora,
    );

  let temVinculo = false;
  let perfil: ReturnType<typeof perfilDoCodigo> = null;
  let podeVerModulo = false;
  // Em /entrar, quem já entrou vai para a primeira tela do perfil: o vínculo é lido também ali.
  if (usuario && !inativo && (!rotaPublica(caminho) || caminho === "/entrar")) {
    const { data: codigo, error } = await supabase.schema("config").rpc("perfil_atual");
    perfil = error ? null : perfilDoCodigo(codigo);
    temVinculo = perfil !== null;
    const modulo = moduloDoCaminho(caminho);
    if (temVinculo && modulo) {
      const { data: pode, error: erroDoPode } = await supabase
        .schema("config")
        .rpc("pode", { p_modulo: modulo, p_acao: "ver" });
      podeVerModulo = !erroDoPode && pode === true;
    }
  }

  // Tela em teste: o Administrador entra sempre; os outros perfis só com o banco em demonstração. O
  // parâmetro é lido com a chave do usuário (RLS), e só quando a rota é de tela em teste.
  let emDemonstracao = false;
  if (temVinculo && perfil !== "Administrador" && ehTelaEmTeste(acharTela(caminho)?.tela)) {
    const { data: parametro, error: erroDoParametro } = await supabase
      .schema("config")
      .from("parametro")
      .select("valor")
      .eq("chave", CHAVE_DA_FAIXA)
      .maybeSingle();
    emDemonstracao = !erroDoParametro && parametro?.valor === "sim";
  }

  const decisao = decidirAcesso(caminho, pedido.nextUrl.search, {
    temUsuario: usuario !== null,
    temVinculo,
    perfil,
    podeVerModulo,
    inativo,
    emDemonstracao,
  });
  if (decisao.tipo === "sair") await supabase.auth.signOut({ scope: "local" });

  const final = responder(pedido, decisao, resposta);
  for (const [nome, valor] of Object.entries(cabecalhosDeCache)) final.headers.set(nome, valor);
  if (usuario && decisao.tipo !== "sair") {
    final.cookies.set(COOKIE_DE_ATIVIDADE, String(agora), opcoesDoCookie({ path: "/" }));
  } else if (decisao.tipo === "sair") {
    final.cookies.set(COOKIE_DE_ATIVIDADE, "", opcoesDoCookie({ path: "/", maxAge: 0 }));
  }
  return final;
}

/** A resposta da decisão, levando os cookies que a renovação (ou a saída) da sessão gravou. */
function responder(pedido: NextRequest, decisao: Decisao, resposta: NextResponse): NextResponse {
  if (decisao.tipo === "seguir") return resposta;
  const final =
    decisao.tipo === "nao-encontrada"
      ? NextResponse.rewrite(new URL("/nao-encontrada", pedido.url), { status: 404 })
      : NextResponse.redirect(new URL(decisao.para, pedido.url));
  for (const cookie of resposta.cookies.getAll()) final.cookies.set(cookie);
  return final;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
