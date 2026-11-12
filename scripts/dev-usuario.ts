// `pnpm dev:usuario -- --pessoa "Demo Ana Almeida" [--perfil ...] [--email ...]` liga o login a uma pessoa
// de demonstração (gestor de frota ou operacional; veja docs/demonstracao.md), sem mostrar CPF.
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
import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";

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
    throw new ErroDoEixo(`Perfil desconhecido: use ${PERFIS.join(", ")}.`);
  }
  const codigo = perfil as CodigoDoPerfil;
  const email = (valor("--email") ?? `dev.${codigo.replace(/_/g, "-")}@eixo.local`)
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDoEixo("E-mail inválido.");
  return { perfil: codigo, email };
}

/** Nulo se a senha serve; senão, o que corrigir. */
export function validarSenha(primeira: string, segunda: string): string | null {
  if (primeira.length < 12) return "A senha precisa de no mínimo 12 caracteres.";
  if (primeira !== segunda) return "As duas senhas não são iguais.";
  return null;
}

const PERFIS_DA_PESSOA_DEMO = ["diretoria", "gestor_de_frota", "operacional"] as const;

function validarEmail(texto: string): string {
  const email = texto.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDoEixo("E-mail inválido.");
  return email;
}

/** O e-mail padrão do login de uma pessoa Demo: sem a marca, sem acento, com hífen (demo.ana-almeida@eixo.local). */
function emailDaPessoaDemo(nome: string): string {
  const resto = nome
    .replace(/^Demo\s+/, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `demo.${resto}@eixo.local`;
}

/**
 * `--pessoa "Demo Ana Almeida"`: liga o login a uma pessoa de demonstração (gestor de frota ou
 * operacional) em vez da pessoa de teste do perfil. Nulo quando o argumento não vem. O perfil, se não
 * vier, sai do papel da pessoa (perfilDaPessoaDemo).
 */
export function lerLoginDePessoaDemo(
  argv: readonly string[],
): { pessoa: string; perfil: CodigoDoPerfil | null; email: string } | null {
  const valor = (nome: string) => {
    const i = argv.indexOf(nome);
    return i >= 0 ? (argv[i + 1] ?? "") : null;
  };
  const pessoa = valor("--pessoa");
  if (pessoa === null) return null;
  const nome = pessoa.trim();
  if (!/^Demo\s+\S/.test(nome)) {
    throw new ErroDoEixo('O --pessoa só aceita pessoa de demonstração: o nome começa com "Demo".');
  }
  const pedido = valor("--perfil");
  let perfil: CodigoDoPerfil | null = null;
  if (pedido !== null) {
    if (!(PERFIS as readonly string[]).includes(pedido)) {
      throw new ErroDoEixo(`Perfil desconhecido: use ${PERFIS_DA_PESSOA_DEMO.join(", ")}.`);
    }
    if (!(PERFIS_DA_PESSOA_DEMO as readonly string[]).includes(pedido)) {
      throw new ErroDoEixo(
        `Para uma pessoa Demo, use o perfil ${PERFIS_DA_PESSOA_DEMO.join(", ")} (o Administrador é o login de teste).`,
      );
    }
    perfil = pedido as CodigoDoPerfil;
  }
  const email = validarEmail(valor("--email") ?? emailDaPessoaDemo(nome));
  return { pessoa: nome, perfil, email };
}

/**
 * Entre as pessoas com o mesmo nome Demo (um gestor e um funcionário podem coincidir), escolhe a do login:
 * sem perfil, o gestor; com operacional, quem não é gestor. Sem como decidir, pede o perfil.
 */
export function escolherPessoaDemo<T extends { gestor: boolean }>(
  achadas: readonly T[],
  pedido: CodigoDoPerfil | null,
): T {
  if (achadas.length === 0) {
    throw new ErroDoEixo(
      "Não há pessoa Demo com esse nome: carregue a demonstração (pnpm demo:carregar) e confira o nome.",
    );
  }
  if (achadas.length === 1) return achadas[0]!;
  const candidatas = achadas.filter((p) => (pedido === "operacional" ? !p.gestor : p.gestor));
  if (candidatas.length === 1) return candidatas[0]!;
  throw new ErroDoEixo(
    "Há mais de uma pessoa com esse nome: diga o perfil com --perfil (gestor_de_frota ou operacional).",
  );
}

/** O perfil do login da pessoa Demo: o pedido, ou gestor de frota para quem tem o papel, ou operacional. */
export function perfilDaPessoaDemo(
  temPapelDeGestor: boolean,
  pedido: CodigoDoPerfil | null,
): CodigoDoPerfil {
  if (pedido === "gestor_de_frota" && !temPapelDeGestor) {
    throw new ErroDoEixo(
      "Essa pessoa Demo não tem o papel de gestor de frota: escolha outro perfil.",
    );
  }
  return pedido ?? (temPapelDeGestor ? "gestor_de_frota" : "operacional");
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
    return Promise.reject(new ErroDoEixo("Rode no terminal: a senha é digitada, sem eco."));
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
          recusar(new ErroDoEixo("Cancelado."));
          return;
        }
        if (caractere === "\u007f" || caractere === "\b") texto = texto.slice(0, -1);
        else texto += caractere;
      }
    };
    entrada.on("data", aoLer);
  });
}

/** A pessoa Demo pelo nome (nunca pelo CPF): o id, se tem o papel de gestor e se o e-mail já é de outra pessoa. */
async function acharPessoaDemo(nome: string, email: string, pedido: CodigoDoPerfil | null) {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; gestor: boolean }>(
      `select p.id, exists (select 1 from nucleo.papel_da_pessoa pp where pp.pessoa_id = p.id and pp.papel = 'gestor_de_frota') as gestor
         from nucleo.pessoa p where p.nome = $1 and p.excluido_em is null`,
      [nome],
    );
    const escolhida = escolherPessoaDemo(rows, pedido);
    const ocupado = await banco.query<{ pessoa_id: string }>(
      `select u.pessoa_id from nucleo.usuario u join auth.users a on a.id = u.auth_user_id where lower(a.email) = $1`,
      [email],
    );
    if (ocupado.rows[0] && ocupado.rows[0].pessoa_id !== escolhida.id) {
      throw new ErroDoEixo("Esse e-mail já está ligado a outra pessoa: escolha outro com --email.");
    }
    return escolhida;
  });
}

async function principal() {
  const argv = process.argv.slice(2);
  let { perfil, email } = lerArgumentosDoUsuario(argv);
  const demo = lerLoginDePessoaDemo(argv);
  if (demo) email = demo.email;
  const local = supabaseLocal();
  if (!enderecoLocal(local.url) || !bancoLocal(local.banco)) {
    throw new ErroDoEixo("Recusado: o dev:usuario só roda no Supabase local.");
  }
  let pessoaDemoId: string | null = null;
  if (demo) {
    const achada = await acharPessoaDemo(demo.pessoa, email, demo.perfil);
    pessoaDemoId = achada.id;
    perfil = perfilDaPessoaDemo(achada.gestor, demo.perfil);
  }

  const primeira = await lerSenhaSemEco(`Senha para ${email} (mínimo 12 caracteres): `);
  const segunda = await lerSenhaSemEco("Digite a senha de novo: ");
  const problema = validarSenha(primeira, segunda);
  if (problema) throw new ErroDoEixo(problema);

  const admin = createClient(local.url, local.chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: lista, error: erroDaLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (erroDaLista)
    throw new ErroDoEixo(`Não foi possível ler os usuários (${textoDoErro(erroDaLista)}).`);
  const existente = lista.users.find((u) => u.email === email);
  const { error } = existente
    ? await admin.auth.admin.updateUserById(existente.id, { password: primeira })
    : await admin.auth.admin.createUser({ email, password: primeira, email_confirm: true });
  if (error) throw new ErroDoEixo(`O Auth local recusou (${textoDoErro(error)}).`);

  // A Pessoa de teste do perfil (achada pelo CPF), o papel de gestor e o vínculo, como no Studio.
  await comBanco(async (banco) => {
    if (pessoaDemoId) {
      // Pessoa Demo: só liga o login e, no Operacional, dá as filiais (o escopo do pátio).
      await banco.query("select nucleo.vincular_usuario($1, $2, $3)", [
        email,
        pessoaDemoId,
        perfil,
      ]);
      if (perfil === "operacional") {
        await banco.query(
          `insert into nucleo.usuario_filial (usuario_id, filial_id) select $1, f.id from config.filial f where f.excluido_em is null on conflict do nothing`,
          [pessoaDemoId],
        );
      }
      return;
    }
    const base = BASE_DO_CPF[perfil];
    const { rows } = await banco.query<{ documento: string }>(
      `select base || d1::text || d2::text as documento
         from (select $1::text as base) b, generate_series(0, 9) d1, generate_series(0, 9) d2
        where nucleo.documento_valido(base || d1::text || d2::text)
        limit 1`,
      [base],
    );
    const documento = rows[0]?.documento;
    if (!documento) throw new ErroDoEixo("Sem CPF de teste para o perfil.");
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
    console.error(textoDoErro(erro));
    process.exit(1);
  });
}
