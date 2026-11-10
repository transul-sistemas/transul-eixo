import Link from "next/link";
import { connection } from "next/server";
import { AbaEmBreve } from "@/components/ficha/aba-em-breve";
import { AbasDaFichaNaUrl } from "@/components/ficha/abas-da-ficha-na-url";
import { CabecalhoDaFicha } from "@/components/ficha/cabecalho-da-ficha";
import { FichaDaRaiz } from "@/components/ficha/ficha-da-raiz";
import { formatarData, formatarMes } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerFichaDaPessoa } from "@/lib/dados/pessoas";
import type { FichaDaPessoa } from "@/lib/dados/pessoas-tipos";
import { SIGLAS_DA_ESCALA } from "@/lib/dominio/esquemas/pessoa";
import { lerAba } from "@/lib/navegacao/ficha";
import {
  ABAS_DA_PESSOA,
  type AbaDaPessoa,
  enderecoDaEscala,
  IDS_DAS_ABAS_DA_PESSOA,
} from "@/lib/navegacao/pessoas";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { EditarPessoa } from "../editar-pessoa";
import { paraParametros, type ParametrosDaBusca } from "../pagina-de-pessoas";
import { TabelaDosVinculos } from "./tabela-dos-vinculos";
import { VoltarALista } from "./voltar-a-lista";

// A ficha da pessoa (primeira versão): cabeçalho com o assistente "Editar pessoa" e as abas Resumo
// (dados, vínculo de hoje e a escala do mês) e Vínculos (operação × função com vigência); as demais
// em breve. O CPF só aparece mascarado. Tudo pronto do banco (nucleo.ficha_da_pessoa).

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-sm">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Resumo({ ficha }: { ficha: FichaDaPessoa }) {
  const { pessoa, vinculoAtual, escala } = ficha;
  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="titulo-dos-dados"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <h3 id="titulo-dos-dados" className="text-base font-semibold">
          Dados da pessoa
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Dado rotulo="CPF">
            <span className="tabular-nums">{pessoa.documentoMascarado ?? "sem CPF"}</span>
          </Dado>
          <Dado rotulo="E-mail">{pessoa.email ?? "sem e-mail"}</Dado>
          <Dado rotulo="Papéis">
            {pessoa.papeis.length > 0 ? pessoa.papeis.join(", ") : "nenhum"}
          </Dado>
          <Dado rotulo="Cód. parceiro (Sankhya)">
            {pessoa.codparc === null ? "sem código" : formatarInteiro(pessoa.codparc)}
          </Dado>
        </dl>
        {pessoa.cadastroPendente ? (
          <p className="text-muted-foreground text-sm">
            Cadastro pendente: a pessoa veio da v1 sem CPF. O CPF entra pela fila de exceções.
          </p>
        ) : null}
      </section>
      <section
        aria-labelledby="titulo-do-vinculo"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <h3 id="titulo-do-vinculo" className="text-base font-semibold">
          Vínculo de hoje
        </h3>
        {vinculoAtual ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Dado rotulo="Operação">{vinculoAtual.operacao}</Dado>
            <Dado rotulo="Função">{vinculoAtual.funcaoNome}</Dado>
            <Dado rotulo="Desde">
              <span className="tabular-nums">{formatarData(vinculoAtual.inicio)}</span>
            </Dado>
            <Dado rotulo={`Escala de ${formatarMes(escala.mes)}`}>
              <span className="tabular-nums">
                {SIGLAS_DA_ESCALA.map((s) => `${s.id} ${formatarInteiro(escala[s.id])}`).join(
                  " · ",
                )}
              </span>
            </Dado>
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sem vínculo com operação hoje. Vincule pelo Editar pessoa para a pessoa entrar na
            escala.
          </p>
        )}
        {vinculoAtual ? (
          <Link
            href={enderecoDaEscala(vinculoAtual.operacaoId, escala.mes)}
            className="text-primary focus-visible:ring-ring/50 self-start text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          >
            Abrir a escala da operação
          </Link>
        ) : null}
      </section>
    </div>
  );
}

/** A linha do tempo curta da ficha: os vínculos em ordem, do mais antigo ao de hoje. */
function LinhaDosVinculos({ ficha }: { ficha: FichaDaPessoa }) {
  if (ficha.vinculos.length === 0) {
    return <p className="text-muted-foreground text-sm">Ainda sem vínculos com operação.</p>;
  }
  const emOrdem = [...ficha.vinculos].reverse();
  return (
    <ol
      aria-label="Vínculos ao longo do tempo"
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      {emOrdem.map((v, i) => (
        <li key={v.id} className="flex items-center gap-2">
          {i > 0 ? (
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
          ) : null}
          <span
            className={
              v.vigente
                ? "border-primary bg-primary/10 rounded-lg border px-2 py-1"
                : "border-border text-muted-foreground rounded-lg border px-2 py-1"
            }
          >
            {v.funcaoNome} em {v.operacao}
            <span className="tabular-nums">
              {" "}
              ({formatarData(v.inicio)} a {v.fim ? formatarData(v.fim) : "hoje"})
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A ficha da pessoa. Sem a pessoa (ou arquivada), o aviso com o caminho de volta. */
export async function FichaDaPessoaNaTela({
  id,
  searchParams,
}: {
  id: string;
  searchParams: ParametrosDaBusca;
}) {
  await connection();
  const sessao = await exigirSessao();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <VoltarALista />
        <ListaVazia
          titulo="A ficha da pessoa lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco."
        />
      </div>
    );
  }
  const ficha = await lerFichaDaPessoa(id);
  if (!ficha) {
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <VoltarALista />
        <h1 className="text-3xl font-semibold tracking-tight">Pessoa não encontrada</h1>
        <ListaVazia
          titulo="Esta pessoa não está ao seu alcance"
          descricao="Ela pode ter sido arquivada. Volte à lista e procure de novo."
        />
      </div>
    );
  }

  const { pessoa, vinculoAtual } = ficha;
  const podeEditar = temPermissao(sessao.perfil, { modulo: "pessoas", acao: "editar" });
  const emBreve = (nome: string, descricao: string) => (
    <AbaEmBreve nome={nome} descricao={descricao} modulo="pessoas" />
  );

  const conteudos: Record<AbaDaPessoa, React.ReactNode> = {
    resumo: <Resumo ficha={ficha} />,
    vinculos:
      ficha.vinculos.length === 0 ? (
        <ListaVazia
          titulo="Nenhum vínculo ainda"
          descricao="Os vínculos aparecem aqui quando a pessoa for posta numa operação pelo Editar pessoa."
        />
      ) : (
        <TabelaDosVinculos vinculos={ficha.vinculos} />
      ),
    "linha-do-tempo": emBreve(
      "Linha do tempo",
      "Mostra os vínculos, a escala e os eventos da pessoa ao longo do tempo.",
    ),
    documentos: emBreve("Documentos", "Guarda a CNH, os exames e os vencimentos da pessoa."),
    resultado: emBreve("Resultado", "Mostra as diárias e a premiação da pessoa."),
    mapa: emBreve("Mapa", "Mostra onde a pessoa está trabalhando."),
    "mapa-mental": emBreve(
      "Mapa mental",
      "Mostra a pessoa ligada às operações, às placas e aos documentos.",
    ),
  };

  return (
    <FichaDaRaiz
      cabecalho={
        <CabecalhoDaFicha
          voltar={<VoltarALista />}
          titulo={pessoa.nome}
          subtitulo={`CPF ${pessoa.documentoMascarado ?? "pendente"}`}
          situacao={
            <span className="text-muted-foreground text-sm">
              {vinculoAtual
                ? `${vinculoAtual.funcaoNome} em ${vinculoAtual.operacao}`
                : "Sem vínculo hoje"}
            </span>
          }
          acoes={podeEditar ? <EditarPessoa ficha={ficha} usuario={sessao.usuarioId} /> : undefined}
        />
      }
      linhaDoTempo={<LinhaDosVinculos ficha={ficha} />}
    >
      <AbasDaFichaNaUrl<AbaDaPessoa>
        abas={ABAS_DA_PESSOA}
        abaInicial={lerAba(parametros, IDS_DAS_ABAS_DA_PESSOA)}
        conteudos={conteudos}
      />
    </FichaDaRaiz>
  );
}

/** O que se vê enquanto a ficha chega: o esqueleto do cabeçalho e das abas. */
export function FichaDaPessoaCarregando() {
  return (
    <div
      role="status"
      aria-label="Carregando a ficha da pessoa"
      className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8"
    >
      <span className="sr-only">Carregando a ficha da pessoa</span>
      <div aria-hidden className="flex flex-col gap-5">
        <span className="bg-muted block h-5 w-28 animate-pulse rounded" />
        <span className="bg-muted block h-10 w-72 animate-pulse rounded" />
        <span className="bg-muted block h-9 w-full animate-pulse rounded-lg" />
        <span className="bg-muted block h-64 max-w-4xl animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
