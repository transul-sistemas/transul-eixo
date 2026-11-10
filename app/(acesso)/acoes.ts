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
  /** A troca de senha pediu reautenticação: o formulário mostra o campo do código do e-mail. */
  pedirCodigo?: boolean;
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
  anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const pedirCodigo = anterior.pedirCodigo === true;
  const codigo = formulario.get("codigo");
  const dados = ESQUEMA_DE_NOVA_SENHA.safeParse({
    senha: formulario.get("senha"),
    confirmacao: formulario.get("confirmacao"),
    codigo: typeof codigo === "string" && codigo.trim() !== "" ? codigo.trim() : undefined,
  });
  if (!dados.success)
    return { erro: dados.error.issues[0]?.message ?? "Confira a senha.", pedirCodigo };

  const supabase = await criarClienteDoServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return { erro: 'O link expirou ou já foi usado. Peça um novo em "Esqueci a senha".' };
  const { error } = await supabase.auth.updateUser(
    dados.data.codigo
      ? { password: dados.data.senha, nonce: dados.data.codigo }
      : { password: dados.data.senha },
  );
  if (error?.code === "reauthentication_needed") return await mandarCodigo(supabase);
  if (error?.code === "reauthentication_not_valid")
    return {
      erro: "O código não confere ou venceu. Confira o último e-mail que mandamos e digite de novo.",
      pedirCodigo: true,
    };
  if (error)
    return {
      erro: "Não foi possível trocar a senha. Escolha outra (no mínimo 12 caracteres) e tente de novo.",
      pedirCodigo,
    };
  redirect(await destinoDepoisDeEntrar(supabase, undefined));
}

/**
 * Sem login recente, o Supabase (secure_password_change) só troca a senha com o código que manda ao
 * e-mail de quem está logado. A recuperação por e-mail não passa por aqui: o link já é um login recente.
 */
async function mandarCodigo(
  supabase: Awaited<ReturnType<typeof criarClienteDoServidor>>,
): Promise<EstadoDoFormulario> {
  const { error } = await supabase.auth.reauthenticate();
  if (error)
    return {
      erro: "Não foi possível mandar o código ao seu e-mail agora. Espere um minuto e tente de novo.",
    };
  return {
    aviso:
      "Para confirmar que é você, mandamos um código de 6 dígitos ao seu e-mail. Digite a senha nova de novo e o código.",
    pedirCodigo: true,
  };
}
