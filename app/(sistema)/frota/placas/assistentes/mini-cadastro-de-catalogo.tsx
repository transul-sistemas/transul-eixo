"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import {
  Campo,
  CampoComMais,
  CLASSE_DO_CAMPO,
  type OpcaoDeSelecao,
} from "@/components/wizard/campos";
import type { ItemCriado } from "@/lib/dados/escrita-tipos";
import { esquemaItemDeCatalogo, type TipoDeItemDeCatalogo } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { criarItemDeCatalogoAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";

// O mini-wizard do "+": cria marca, modelo, gestor, operação, CR ou filial sem sair do assistente de
// baixo. Usa o mesmo motor (variante empilhado) e o mesmo esquema do servidor. O CR pede também o código
// do Sankhya (CODCENCUS). No banco, o "+" só existe para o que tem caminho seguro (marca, modelo e CR):
// os outros campos ficam só com a lista.

interface Valores {
  nome: string;
  /** Só no CR: o CODCENCUS digitado (vira número na conferência). */
  codcencus: string;
}

const TEXTOS: Record<
  TipoDeItemDeCatalogo,
  { acao: string; rotuloDoNome: string; concluido: string }
> = {
  marca: { acao: "Cadastrar marca", rotuloDoNome: "Nome da marca", concluido: "Marca cadastrada." },
  modelo: {
    acao: "Cadastrar modelo",
    rotuloDoNome: "Nome do modelo",
    concluido: "Modelo cadastrado.",
  },
  gestor: {
    acao: "Cadastrar gestor",
    rotuloDoNome: "Nome do gestor",
    concluido: "Gestor cadastrado.",
  },
  operacao: {
    acao: "Cadastrar operação",
    rotuloDoNome: "Nome da operação",
    concluido: "Operação cadastrada.",
  },
  cr: { acao: "Cadastrar CR", rotuloDoNome: "Código do CR", concluido: "CR cadastrado." },
  filial: {
    acao: "Cadastrar filial",
    rotuloDoNome: "Nome da filial",
    concluido: "Filial cadastrada.",
  },
};

/** O texto do botão "+" de cada tipo (o mesmo nome do mini-wizard que ele abre). */
export const ACAO_DO_MAIS = (tipo: TipoDeItemDeCatalogo) => TEXTOS[tipo].acao;

const ROTULO_DO_CODCENCUS = "Código do Sankhya (CODCENCUS)";

function entradaDoItem(tipo: TipoDeItemDeCatalogo, valores: Valores, paiId?: string) {
  const codcencus = valores.codcencus?.trim() === "" ? undefined : Number(valores.codcencus);
  return {
    tipo,
    nome: valores.nome,
    ...(tipo === "cr" ? { codcencus } : {}),
    ...(paiId ? { paiId } : {}),
  };
}

export function MiniCadastroDeCatalogo({
  tipo,
  paiId,
  aoCriar,
  aoFechar,
  focoFinal,
}: {
  tipo: TipoDeItemDeCatalogo;
  /** A marca do modelo, ou a operação do CR. */
  paiId?: string;
  /** Chamado com o item criado: quem chamou o acrescenta ao catálogo e escolhe no campo. */
  aoCriar: (item: ItemCriado, opcao: OpcaoDeSelecao) => void;
  aoFechar: () => void;
  focoFinal: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const textos = TEXTOS[tipo];
  const campos = tipo === "cr" ? ["nome", "codcencus"] : ["nome"];
  const definicao: DefinicaoDeAssistente = {
    id: `catalogo-${tipo}`,
    titulo: textos.acao,
    versaoDoEsquema: 2,
    passos: [
      { id: "dados", titulo: "Dados", campos },
      { id: "conferir", titulo: "Conferir", campos: [] },
    ],
  };
  const resolver: Resolver<Valores> = async (valores) => {
    const resultado = esquemaItemDeCatalogo.safeParse(entradaDoItem(tipo, valores, paiId));
    const problemas = resultado.success
      ? []
      : resultado.error.issues
          .filter((i) => campos.includes(String(i.path[0])))
          .map((i) => ({ path: i.path, message: i.message }));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  return (
    <Assistente<Valores>
      definicao={definicao}
      resolver={resolver}
      valoresIniciais={{ nome: "", codcencus: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      variante="empilhado"
      rascunho={false}
      fecharAoGravar
      focoFinal={focoFinal}
      rotuloConcluir={textos.acao}
      mensagemConcluido={textos.concluido}
      aoConcluir={(valores, chaveDeEnvio) =>
        criarItemDeCatalogoAcao({ chaveDeEnvio, dados: entradaDoItem(tipo, valores, paiId) })
      }
      aoGravar={(linha) => {
        const item = linha as ItemCriado;
        aoCriar(item, { id: item.id, nome: item.nome });
      }}
      aoFechar={aoFechar}
      resumo={(valores) => [
        {
          titulo: textos.concluido.replace(/ cadastrad[oa]\.$/, ""),
          linhas: [
            { rotulo: tipo === "cr" ? "Código" : "Nome", valor: valores.nome?.trim() },
            ...(tipo === "cr" ? [{ rotulo: "CODCENCUS", valor: valores.codcencus?.trim() }] : []),
          ],
        },
      ]}
      renderPasso={(_, form) => (
        <>
          <Campo rotulo={textos.rotuloDoNome} erro={form.formState.errors.nome?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("nome")}
                autoComplete="off"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
          {tipo === "cr" ? (
            <Campo
              rotulo={ROTULO_DO_CODCENCUS}
              erro={form.formState.errors.codcencus?.message}
              ajuda="Todo CR vem do Sankhya: o CR novo nasce a conferir até a ponte confirmar."
            >
              {(p) => (
                <input
                  {...p}
                  {...form.register("codcencus")}
                  autoComplete="off"
                  inputMode="numeric"
                  className={CLASSE_DO_CAMPO}
                />
              )}
            </Campo>
          ) : null}
        </>
      )}
    />
  );
}

/** O que o `CampoComMais` pede em `renderMini`: o mini-wizard do tipo, que avisa quem hospeda do item criado. */
export function renderizarMini(
  mini: {
    aoCriar: (opcao: OpcaoDeSelecao) => void;
    aoFechar: () => void;
    focoFinal: RefObject<HTMLElement | null>;
  },
  tipo: TipoDeItemDeCatalogo,
  paiId: string | undefined,
  aoItemCriado: (item: ItemCriado) => void,
) {
  return (
    <MiniCadastroDeCatalogo
      tipo={tipo}
      paiId={paiId}
      aoCriar={(item, opcao) => {
        aoItemCriado(item);
        mini.aoCriar(opcao);
      }}
      aoFechar={mini.aoFechar}
      focoFinal={mini.focoFinal}
    />
  );
}

/**
 * Um campo de seleção de catálogo: com o "+" quando a fonte cria aquele tipo, ou só a lista quando
 * não cria (no banco, operação, gestor e filial vêm de outros módulos).
 */
export function CampoDoCatalogo({
  rotulo,
  tipo,
  criaveis,
  opcoes,
  valor,
  aoMudar,
  erro,
  semOpcao,
  desligadoPorque,
  paiId,
  aoItemCriado,
}: {
  rotulo: string;
  tipo: TipoDeItemDeCatalogo;
  criaveis: readonly TipoDeItemDeCatalogo[];
  opcoes: readonly OpcaoDeSelecao[];
  valor: string;
  aoMudar: (id: string) => void;
  erro?: string;
  /** O que dizer quando a lista está vazia (sem o convite ao "+", que entra só quando há "+"). */
  semOpcao?: string;
  desligadoPorque?: string;
  paiId?: string;
  aoItemCriado: (item: ItemCriado) => void;
}) {
  if (criaveis.includes(tipo)) {
    return (
      <CampoComMais
        rotulo={rotulo}
        rotuloDoMais={ACAO_DO_MAIS(tipo)}
        opcoes={opcoes}
        valor={valor}
        aoMudar={aoMudar}
        erro={erro}
        semOpcao={semOpcao ? `${semOpcao} Use o + para cadastrar.` : undefined}
        desligadoPorque={desligadoPorque}
        renderMini={(m) => renderizarMini(m, tipo, paiId, aoItemCriado)}
      />
    );
  }
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={opcoes.length === 0 ? semOpcao : undefined}>
      {(p) => (
        <select
          {...p}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className={CLASSE_DO_CAMPO}
        >
          <option value="">Escolha…</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      )}
    </Campo>
  );
}
