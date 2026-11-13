import Link from "next/link";
import { enderecoDoCsv } from "@/lib/navegacao/exportacao";
import { connection } from "next/server";
import { formatarInteiro } from "@/components/formato/numero";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { Button } from "@/components/ui/button";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { ClienteDeCadastros } from "@/lib/dados/catalogos-cadastro";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerMatriz, listarUsuarios, matrizDoPerfil } from "@/lib/dados/usuarios-e-perfis";
import { acharTela } from "@/lib/navegacao/catalogo";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { cn } from "@/lib/utils";
import { MatrizDoPerfilNaTela } from "./matriz-do-perfil";
import { TabelaDeUsuarios } from "./tabela-de-usuarios";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/admin/usuarios-e-perfis";
const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Usuários e perfis", descricao: tela?.descricao };
}

export function enderecoDosUsuarios(estado: { busca?: string; perfil?: string }): string {
  const p = new URLSearchParams();
  if (estado.busca) p.set("q", estado.busca);
  if (estado.perfil) p.set("perfil", estado.perfil);
  const texto = p.toString();
  return texto ? `${ROTA}?${texto}` : ROTA;
}

export function PaginaDeUsuariosCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando usuários" />
    </PaginaDeLeitura>
  );
}

export async function PaginaDeUsuarios({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const bruto = await searchParams;
  const busca = (primeiro(bruto.q) ?? "").trim();
  const { titulo, descricao } = cabecalho();
  const sessao = await exigirSessao();

  if (modoDosDados() === "exemplo") {
    return (
      <PaginaDeLeitura titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="Os usuários leem do banco"
          descricao="Esta tela só funciona com o banco local ligado. Abra o sistema sem o modo de exemplo para ver os usuários."
        />
      </PaginaDeLeitura>
    );
  }

  const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeCadastros;
  const [usuarios, dados] = await Promise.all([listarUsuarios(cliente, busca), lerMatriz(cliente)]);
  const matriz = matrizDoPerfil(dados, primeiro(bruto.perfil));
  const podeEditar = temPermissao(sessao.perfil, { modulo: "admin", acao: "editar" });

  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      exportar={enderecoDoCsv(
        "admin.usuarios-e-perfis",
        new URLSearchParams(busca ? { q: busca } : {}),
      )}
    >
      <section aria-labelledby="titulo-usuarios" className="flex flex-col gap-3">
        <h2 id="titulo-usuarios" className="text-xl font-semibold">
          Usuários
        </h2>
        <form
          role="search"
          aria-label="Consulta"
          method="get"
          action={ROTA}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="perfil" value={matriz.perfil.codigo} />
          <input
            type="search"
            name="q"
            defaultValue={busca}
            aria-label="Buscar usuário"
            placeholder="Buscar pelo nome"
            autoComplete="off"
            className={cn(CLASSE_DO_CAMPO, "max-w-sm")}
          />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <p data-testid="resumo-da-pagina" className="text-muted-foreground text-sm">
          {formatarInteiro(usuarios.length)} {usuarios.length === 1 ? "usuário" : "usuários"}
          {busca ? ` com "${busca}" no nome` : ""}.
        </p>
        {usuarios.length === 0 ? (
          <ListaVazia
            titulo={busca ? "Nenhum usuário encontrado" : "Ainda não há usuários"}
            descricao={
              busca
                ? "Nenhum usuário tem esse nome. Limpe a busca ou confira a escrita."
                : "Quando alguém tiver login ligado a uma pessoa, aparece aqui."
            }
            hrefLimpar={busca ? enderecoDosUsuarios({ perfil: matriz.perfil.codigo }) : undefined}
          />
        ) : (
          <TabelaDeUsuarios
            usuarios={usuarios}
            perfis={dados.perfis}
            podeEditar={podeEditar}
            quemUsa={sessao.usuarioId}
          />
        )}
        <div
          data-testid="como-pedir-login"
          className="border-border bg-card text-muted-foreground max-w-[72ch] rounded-xl border p-4 text-sm"
        >
          <p className="text-foreground font-medium">Como pedir um login novo</p>
          <p>
            Esta tela muda o perfil e a situação de quem já tem login, mas não cria login. O login
            novo nasce no Supabase, com uma chave que o sistema não guarda. Peça a quem cuida do
            Supabase para criar o login e ligá-lo à pessoa; depois ele aparece aqui e você escolhe o
            perfil.
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-matriz" className="flex flex-col gap-3">
        <h2 id="titulo-matriz" className="text-xl font-semibold">
          Permissões do perfil
        </h2>
        <nav aria-label="Perfis" className="flex flex-wrap gap-2">
          {dados.perfis.map((p) => (
            <Link
              key={p.codigo}
              href={enderecoDosUsuarios({ busca, perfil: p.codigo })}
              aria-current={p.codigo === matriz.perfil.codigo ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3",
                p.codigo === matriz.perfil.codigo
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {p.nome}
            </Link>
          ))}
        </nav>
        <p className="text-muted-foreground text-sm">
          O que o perfil {matriz.perfil.nome} pode fazer em cada módulo, e em que escopo. Só
          leitura: as permissões mudam por decisão da equipe.
        </p>
        <MatrizDoPerfilNaTela matriz={matriz} />
      </section>
    </PaginaDeLeitura>
  );
}
