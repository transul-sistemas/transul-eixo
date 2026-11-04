"use server";
// ação pública: entrar e pedir o link de recuperação acontecem antes de haver sessão (não há permissão
// a conferir); definir a nova senha exige a sessão criada pelo link (getUser); sair só encerra a própria.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { moduloDoCaminho } from "@/lib/seguranca/acesso";
import { COOKIE_DE_ATIVIDADE } from "@/lib/seguranca/inatividade";
import { caminhoInterno, destinoInicial } from "@/lib/seguranca/redirecionamento";
import { perfilDoCodigo } from "@/lib/seguranca/sessao";
import { opcoesDoCookie } from "@/lib/supabase/cookies";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { ESQUEMA_DE_ENTRADA, ESQUEMA_DE_NOVA_SENHA, ESQUEMA_DE_RECUPERACAO } from "./esquemas";

export interface EstadoDoFormulario {
  erro?: string;
  aviso?: string;
}

/** Um único erro, nunca revela se o e-mail existe. */
const ERRO_DE_ENTRADA = "E-mail ou senha incorretos. Confira e tente de novo.";

export async function entrar(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const dados = ESQUEMA_DE_ENTRADA.safeParse({
    email: formulario.get("email"),
    senha: formulario.get("senha"),
    proximo: formulario.get("proximo") ?? undefined,
  });
  if (!dados.success) return { erro: ERRO_DE_ENTRADA };

  const supabase = await criarClienteDoServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error) return { erro: ERRO_DE_ENTRADA };

  (await cookies()).set(COOKIE_DE_ATIVIDADE, String(Date.now()), opcoesDoCookie({ path: "/" }));
  redirect(await destinoDepoisDeEntrar(supabase, dados.data.proximo));
}

/**
 * O redirect da Server Action desenha o destino na mesma resposta, sem passar pelo proxy: as regras do
 * proxy valem aqui também (sem vínculo, acesso não liberado; sem ver o módulo, a primeira tela do
 * perfil). Sem "proximo", com um de fora ou com a raiz, a primeira tela do perfil (aprovação da 3.8).
 */
async function destinoDepoisDeEntrar(
  supabase: Awaited<ReturnType<typeof criarClienteDoServidor>>,
  proximo: string | undefined,
): Promise<string> {
  const { data: codigo } = await supabase.schema("config").rpc("perfil_atual");
  const perfil = perfilDoCodigo(codigo);
  if (!perfil) return "/acesso-nao-liberado";
  const primeiraTela = destinoInicial(perfil);
  const destino = proximo ? caminhoInterno(proximo) : null;
  if (!destino) return primeiraTela;
  const modulo = moduloDoCaminho(destino.split(/[?#]/)[0] ?? destino);
  if (!modulo) return primeiraTela;
  const { data: pode } = await supabase
    .schema("config")
    .rpc("pode", { p_modulo: modulo, p_acao: "ver" });
  return pode === true ? destino : primeiraTela;
}

export async function sair(): Promise<void> {
  z.object({}).parse({});
  const supabase = await criarClienteDoServidor();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).set(COOKIE_DE_ATIVIDADE, "", opcoesDoCookie({ path: "/", maxAge: 0 }));
  redirect("/entrar");
}

/** A mesma resposta, exista o e-mail ou não. */
const AVISO_DE_RECUPERACAO =
  "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por uma hora.";

export async function pedirRecuperacao(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const dados = ESQUEMA_DE_RECUPERACAO.safeParse({ email: formulario.get("email") });
  if (!dados.success) return { erro: "Informe um e-mail válido." };

  const cabecalhos = await headers();
  const origem = `${cabecalhos.get("x-forwarded-proto") ?? "http"}://${cabecalhos.get("host") ?? "localhost:3000"}`;
  const supabase = await criarClienteDoServidor();
  await supabase.auth.resetPasswordForEmail(dados.data.email, {
    redirectTo: `${origem}/auth/confirmar?proximo=/nova-senha`,
  });
  return { aviso: AVISO_DE_RECUPERACAO };
}

export async function definirNovaSenha(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const dados = ESQUEMA_DE_NOVA_SENHA.safeParse({
    senha: formulario.get("senha"),
    confirmacao: formulario.get("confirmacao"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Confira a senha." };

  const supabase = await criarClienteDoServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return { erro: 'O link expirou ou já foi usado. Peça um novo em "Esqueci a senha".' };
  const { error } = await supabase.auth.updateUser({ password: dados.data.senha });
  if (error)
    return {
      erro: "Não foi possível trocar a senha. Escolha outra (no mínimo 12 caracteres) e tente de novo.",
    };
  redirect(await destinoDepoisDeEntrar(supabase, undefined));
}
