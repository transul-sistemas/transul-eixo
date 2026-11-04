"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, type OpcaoDeSelecao } from "@/components/wizard/campos";
import type { ItemCriado } from "@/lib/dados/escrita-tipos";
import { esquemaItemDeCatalogo, type TipoDeItemDeCatalogo } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { criarItemDeCatalogoAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";

// O mini-wizard do "+": cria marca, modelo, gestor, operação, CR, filial ou garagem sem sair do
// assistente de baixo. Usa o mesmo motor (variante lateral) e o mesmo esquema do servidor.

interface Valores {
  nome: string;
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
  garagem: {
    acao: "Cadastrar garagem",
    rotuloDoNome: "Nome da garagem",
    concluido: "Garagem cadastrada.",
  },
};

/** O texto do botão "+" de cada tipo (o mesmo nome do mini-wizard que ele abre). */
export const ACAO_DO_MAIS = (tipo: TipoDeItemDeCatalogo) => TEXTOS[tipo].acao;

export function MiniCadastroDeCatalogo({
  tipo,
  paiId,
  aoCriar,
  aoFechar,
  focoFinal,
}: {
  tipo: TipoDeItemDeCatalogo;
  /** A marca do modelo, a operação do CR ou a filial da garagem. */
  paiId?: string;
  /** Chamado com o item criado: quem chamou o acrescenta ao catálogo e escolhe no campo. */
  aoCriar: (item: ItemCriado, opcao: OpcaoDeSelecao) => void;
  aoFechar: () => void;
  focoFinal: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const textos = TEXTOS[tipo];
  const definicao: DefinicaoDeAssistente = {
    id: `catalogo-${tipo}`,
    titulo: textos.acao,
    versaoDoEsquema: 1,
    passos: [
      { id: "dados", titulo: "Dados", campos: ["nome"] },
      { id: "conferir", titulo: "Conferir", campos: [] },
    ],
  };
  const resolver: Resolver<Valores> = async (valores) => {
    const resultado = esquemaItemDeCatalogo.safeParse({ tipo, nome: valores.nome, paiId });
    const problemas = resultado.success
      ? []
      : resultado.error.issues
          .filter((i) => i.path[0] === "nome")
          .map((i) => ({ path: i.path, message: i.message }));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  return (
    <Assistente<Valores>
      definicao={definicao}
      resolver={resolver}
      valoresIniciais={{ nome: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      variante="lateral"
      rascunho={false}
      fecharAoGravar
      focoFinal={focoFinal}
      rotuloConcluir={textos.acao}
      mensagemConcluido={textos.concluido}
      aoConcluir={(valores, chaveDeEnvio) =>
        criarItemDeCatalogoAcao({
          chaveDeEnvio,
          dados: { tipo, nome: valores.nome, ...(paiId ? { paiId } : {}) },
        })
      }
      aoGravar={(linha) => {
        const item = linha as ItemCriado;
        aoCriar(item, { id: item.id, nome: item.nome });
      }}
      aoFechar={aoFechar}
      resumo={(valores) => [
        {
          titulo: textos.concluido.replace(/ cadastrad[oa]\.$/, ""),
          linhas: [{ rotulo: tipo === "cr" ? "Código" : "Nome", valor: valores.nome?.trim() }],
        },
      ]}
      renderPasso={(_, form) => (
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
