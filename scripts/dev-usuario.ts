// `pnpm dev:usuario -- [--perfil diretoria|gestor_de_frota|operacional] [--email nome@exemplo.com]`:
// cria ou atualiza um login no Auth do Supabase LOCAL, ligado a uma Pessoa de teste (Administrador por
// padrão), para usar o sistema no `pnpm dev`. Fatia 3.9a.
//  * A senha é digitada por quem roda, no terminal, sem eco e duas vezes (no mínimo 12 caracteres). O
//    script nunca a mostra, nunca a grava em arquivo e não a guarda depois de entregar ao Auth local.
//  * Recusa rodar se o Supabase não for o da própria máquina. Nunca imprime endereço nem chave: lê o
//    `supabase status` por dentro (o mesmo leitor dos e2e).
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { comBanco, supabaseLocal } from "../e2e/apoio/usuarios-de-teste.ts";
import { bancoLocal } from "./db-dev-dados.ts";

const PERFIS = ["administrador", "diretoria", "gestor_de_frota", "operacional"] as const;
type CodigoDoPerfil = (typeof PERFIS)[number];

/** CPF base (9 dígitos) da Pessoa de teste de cada perfil. */
const BASE_DO_CPF: Record<CodigoDoPerfil, string> = {
  administrador: "930000001",
  diretoria: "930000002",
  gestor_de_frota: "930000003",
  operacional: "930000004",
};

export function lerArgumentosDoUsuario(argv: readonly string[]): {
  perfil: CodigoDoPerfil;
  email: string;
} {
  const valor = (nome: string) => {
    const i = argv.indexOf(nome);
    return i >= 0 ? (argv[i + 1] ?? "") : null;
  };
  const perfil = valor("--perfil") ?? "administrador";
  if (!(PERFIS as readonly string[]).includes(perfil)) {
    throw new Error(`Perfil desconhecido: use ${PERFIS.join(", ")}.`);
  }
  const codigo = perfil as CodigoDoPerfil;
  const email = (valor("--email") ?? `dev.${codigo.replace(/_/g, "-")}@eixo.local`)
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  return { perfil: codigo, email };
}

/** Nulo se a senha serve; senão, o que corrigir. */
export function validarSenha(primeira: string, segunda: string): string | null {
  if (primeira.length < 12) return "A senha precisa de no mínimo 12 caracteres.";
  if (primeira !== segunda) return "As duas senhas não são iguais.";
  return null;
}

/** Só o Auth da própria máquina (o Supabase local no Docker). */
export function enderecoLocal(endereco: string): boolean {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

/** Lê do terminal sem mostrar o que se digita (Enter confirma; Ctrl+C cancela). */
function lerSenhaSemEco(pergunta: string): Promise<string> {
  const entrada = process.stdin;
  if (!entrada.isTTY) {
    return Promise.reject(new Error("Rode no terminal: a senha é digitada, sem eco."));
  }
  process.stdout.write(pergunta);
  entrada.setRawMode(true);
  entrada.resume();
  entrada.setEncoding("utf8");
  return new Promise((resolver, recusar) => {
    let texto = "";
    const aoLer = (pedaco: string) => {
      for (const caractere of pedaco) {
        if (caractere === "\r" || caractere === "\n") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", aoLer);
          process.stdout.write("\n");
          resolver(texto);
          return;
        }
        if (caractere === "\u0003") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", aoLer);
          recusar(new Error("Cancelado."));
          return;
        }
        if (caractere === "\u007f" || caractere === "\b") texto = texto.slice(0, -1);
        else texto += caractere;
      }
    };
    entrada.on("data", aoLer);
  });
}

async function principal() {
  const { perfil, email } = lerArgumentosDoUsuario(process.argv.slice(2));
  const local = supabaseLocal();
  if (!enderecoLocal(local.url) || !bancoLocal(local.banco)) {
    throw new Error("Recusado: o dev:usuario só roda no Supabase local.");
  }

  const primeira = await lerSenhaSemEco(`Senha para ${email} (mínimo 12 caracteres): `);
  const segunda = await lerSenhaSemEco("Digite a senha de novo: ");
  const problema = validarSenha(primeira, segunda);
  if (problema) throw new Error(problema);

  const admin = createClient(local.url, local.chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: lista, error: erroDaLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (erroDaLista) throw new Error(`Não foi possível ler os usuários: ${erroDaLista.message}`);
  const existente = lista.users.find((u) => u.email === email);
  const { error } = existente
    ? await admin.auth.admin.updateUserById(existente.id, { password: primeira })
    : await admin.auth.admin.createUser({ email, password: primeira, email_confirm: true });
  if (error) throw new Error(`O Auth local recusou: ${error.message}`);

  // A Pessoa de teste do perfil (achada pelo CPF), o papel de gestor e o vínculo, como no Studio.
  await comBanco(async (banco) => {
    const base = BASE_DO_CPF[perfil];
    const { rows } = await banco.query<{ documento: string }>(
      `select base || d1::text || d2::text as documento
         from (select $1::text as base) b, generate_series(0, 9) d1, generate_series(0, 9) d2
        where nucleo.documento_valido(base || d1::text || d2::text)
        limit 1`,
      [base],
    );
    const documento = rows[0]?.documento;
    if (!documento) throw new Error("Sem CPF de teste para o perfil.");
    let pessoa = (
      await banco.query<{ pessoa_id: string }>(
        "select pessoa_id from nucleo.pessoa_documento where documento = $1",
        [documento],
      )
    ).rows[0]?.pessoa_id;
    if (!pessoa) {
      pessoa = (
        await banco.query<{ pessoa_id: string }>(
          `with nova as (insert into nucleo.pessoa (nome) values ($1) returning id)
           insert into nucleo.pessoa_documento (pessoa_id, documento) select id, $2 from nova returning pessoa_id`,
          [`Pessoa de teste (${perfil.replace(/_/g, " ")})`, documento],
        )
      ).rows[0]?.pessoa_id;
    }
    if (perfil === "gestor_de_frota") {
      await banco.query(
        "insert into nucleo.papel_da_pessoa (pessoa_id, papel) values ($1, 'gestor_de_frota') on conflict do nothing",
        [pessoa],
      );
    }
    await banco.query("select nucleo.vincular_usuario($1, $2, $3)", [email, pessoa, perfil]);
  });
  console.log(
    `Usuário ${email} pronto, com o perfil ${perfil}. O que foi digitado não foi mostrado nem guardado.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
