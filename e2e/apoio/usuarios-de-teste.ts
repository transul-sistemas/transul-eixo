import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

// Os usuários de teste dos e2e (fatia 3.8), um de cada perfil e um sem vínculo, no Auth LOCAL. É o
// único lugar fora de workers/ que usa a chave secreta (para criar o login), e só nos testes: o app
// nunca a vê. O vínculo com a Pessoa é feito como no Studio (nucleo.vincular_usuario, pelo dono do
// banco local). As senhas são sorteadas a cada execução e ficam em e2e/.auth/ (fora do Git).

export const PASTA_DAS_SESSOES = "e2e/.auth";
const ARQUIVO_DAS_SENHAS = `${PASTA_DAS_SESSOES}/senhas.json`;

export const PERFIS_DE_TESTE = [
  { codigo: "administrador", nome: "Administrador", base: "910000001" },
  { codigo: "diretoria", nome: "Diretoria", base: "910000002" },
  { codigo: "gestor_de_frota", nome: "Gestor de frota", base: "910000003" },
  { codigo: "operacional", nome: "Operacional", base: "910000004" },
] as const;
export type CodigoDoPerfil = (typeof PERFIS_DE_TESTE)[number]["codigo"] | "sem_vinculo";

export const emailDe = (codigo: CodigoDoPerfil) => `${codigo.replace(/_/g, "-")}@eixo.teste`;
export const sessaoDe = (codigo: CodigoDoPerfil) => `${PASTA_DAS_SESSOES}/${codigo}.json`;

/** O Supabase local, pelo `supabase status` (nunca de arquivo versionado). */
export function supabaseLocal(): {
  url: string;
  chavePublicavel: string;
  chaveSecreta: string;
  banco: string;
  correio: string;
} {
  const texto = execSync("pnpm exec supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const valores = Object.fromEntries(
    texto
      .split(/\r?\n/)
      .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const exigir = (nome: string) => {
    const valor = valores[nome];
    if (!valor)
      throw new Error(`O supabase status não trouxe ${nome}: o Supabase local está ligado?`);
    return valor;
  };
  return {
    url: exigir("API_URL"),
    chavePublicavel: exigir("PUBLISHABLE_KEY"),
    chaveSecreta: exigir("SECRET_KEY"),
    banco: exigir("DB_URL"),
    correio: valores.MAILPIT_URL ?? exigir("INBUCKET_URL"),
  };
}

/** CPF válido a partir de 9 dígitos (os dois verificadores calculados). */
function cpf(base: string): string {
  const digito = (numeros: string) => {
    const soma = [...numeros].reduce((s, d, i) => s + Number(d) * (numeros.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const primeiro = digito(base);
  return `${base}${primeiro}${digito(`${base}${primeiro}`)}`;
}

export function senhaDe(codigo: CodigoDoPerfil): string {
  const senhas = JSON.parse(readFileSync(ARQUIVO_DAS_SENHAS, "utf8")) as Record<string, string>;
  const senha = senhas[codigo];
  if (!senha)
    throw new Error(`Sem a senha de teste de ${codigo}: rode o projeto "preparar" do Playwright.`);
  return senha;
}

/**
 * Devolve ao usuário a senha guardada pelo "preparar". O teste de recuperação troca a senha do sem
 * vínculo no projeto 1366; sem isto, o 1920 tentava entrar com a senha antiga (CI do PR #31).
 */
export async function restaurarSenha(codigo: CodigoDoPerfil): Promise<void> {
  const local = supabaseLocal();
  const admin = createClient(local.url, local.chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: erroDaLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (erroDaLista) throw erroDaLista;
  const usuario = data.users.find((u) => u.email === emailDe(codigo));
  if (!usuario) throw new Error(`Usuário de teste ${codigo} não existe: rode o "preparar".`);
  const { error } = await admin.auth.admin.updateUserById(usuario.id, {
    password: senhaDe(codigo),
  });
  if (error) throw error;
}

export async function comBanco<T>(acao: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: supabaseLocal().banco });
  await banco.connect();
  try {
    return await acao(banco);
  } finally {
    await banco.end();
  }
}

/** Cria (ou renova) os logins e os vínculos. Idempotente: roda a cada execução dos e2e. */
export async function prepararUsuarios(): Promise<void> {
  const local = supabaseLocal();
  const admin = createClient(local.url, local.chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: lista, error: erroDaLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (erroDaLista) throw erroDaLista;

  if (!existsSync(PASTA_DAS_SESSOES)) mkdirSync(PASTA_DAS_SESSOES, { recursive: true });
  const senhas: Record<string, string> = {};
  const codigos: CodigoDoPerfil[] = [...PERFIS_DE_TESTE.map((p) => p.codigo), "sem_vinculo"];
  for (const codigo of codigos) {
    const senha = `Eixo-${randomBytes(12).toString("base64url")}`;
    senhas[codigo] = senha;
    const existente = lista.users.find((u) => u.email === emailDe(codigo));
    const { error } = existente
      ? await admin.auth.admin.updateUserById(existente.id, { password: senha })
      : await admin.auth.admin.createUser({
          email: emailDe(codigo),
          password: senha,
          email_confirm: true,
        });
    if (error) throw error;
  }
  writeFileSync(ARQUIVO_DAS_SENHAS, JSON.stringify(senhas), "utf8");

  await comBanco(async (banco) => {
    for (const perfil of PERFIS_DE_TESTE) {
      const documento = cpf(perfil.base);
      let pessoa = (
        await banco.query<{ pessoa_id: string }>(
          "select pessoa_id from nucleo.pessoa_documento where documento = $1",
          [documento],
        )
      ).rows[0]?.pessoa_id;
      if (!pessoa) {
        // A pessoa nasce com o documento na mesma transação (o banco confere no fim dela).
        pessoa = (
          await banco.query<{ pessoa_id: string }>(
            `with nova as (insert into nucleo.pessoa (nome) values ($1) returning id)
             insert into nucleo.pessoa_documento (pessoa_id, documento) select id, $2 from nova returning pessoa_id`,
            [`Teste e2e ${perfil.nome}`, documento],
          )
        ).rows[0]?.pessoa_id;
      }
      if (perfil.codigo === "gestor_de_frota") {
        await banco.query(
          "insert into nucleo.papel_da_pessoa (pessoa_id, papel) select $1, 'gestor_de_frota' where not exists (select 1 from nucleo.papel_da_pessoa where pessoa_id = $1 and papel = 'gestor_de_frota')",
          [pessoa],
        );
      }
      await banco.query("select nucleo.vincular_usuario($1, $2, $3)", [
        emailDe(perfil.codigo),
        pessoa,
        perfil.codigo,
      ]);
    }
    // O sem vínculo existe no Auth e não tem vínculo ativo (se algum dia teve, fica desligado).
    await banco.query(
      "update nucleo.usuario set ativo = false where auth_user_id = (select id from auth.users where email = $1)",
      [emailDe("sem_vinculo")],
    );
  });
}
