"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { LinhaDoCatalogo } from "@/lib/dados/catalogos-definicoes";
import {
  type CatalogoEditavel,
  esquemaArquivarItem,
  esquemaEditarItem,
  esquemaIncluirItem,
} from "@/lib/dominio/esquemas/cadastro";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { arquivarItemAcao, editarItemAcao, incluirItemAcao } from "./acoes";

// O assistente de um item de catálogo do Eixo (carroceria, marca, filial e operação): cadastrar, editar
// e arquivar. Os três usam o mesmo motor e os mesmos esquemas do servidor. Arquivar é exclusão lógica:
// o item some das listas, mas fica no histórico com o motivo; pede o nome do item na conferência.

export type ModoDoItem = "cadastrar" | "editar" | "arquivar";

interface Valores {
  nome: string;
  motivo: string;
}

/** O nome do que o catálogo guarda, no singular (todos femininos: "Marca cadastrada"). */
export const SINGULAR_DO_CATALOGO: Record<CatalogoEditavel, string> = {
  carroceria: "carroceria",
  marca: "marca",
  filial: "filial",
  operacao: "operação",
};

const VERBOS: Record<ModoDoItem, { acao: string; participio: string }> = {
  cadastrar: { acao: "Cadastrar", participio: "cadastrada" },
  editar: { acao: "Editar", participio: "editada" },
  arquivar: { acao: "Arquivar", participio: "arquivada" },
};

export function textoDoBotao(modo: ModoDoItem, catalogo: CatalogoEditavel): string {
  return `${VERBOS[modo].acao} ${SINGULAR_DO_CATALOGO[catalogo]}`;
}

export function AssistenteDoItem({
  modo,
  catalogo,
  linha,
  aoFechar,
  focoFinal,
}: {
  modo: ModoDoItem;
  catalogo: CatalogoEditavel;
  /** Em editar e arquivar: o item e a versão que a pessoa vê. */
  linha?: LinhaDoCatalogo;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const singular = SINGULAR_DO_CATALOGO[catalogo];
  const titulo = textoDoBotao(modo, catalogo);
  const nomeAtual = linha?.celulas.nome ?? "";
  const campos = modo === "arquivar" ? ["motivo"] : ["nome"];
  const definicao: DefinicaoDeAssistente = {
    id: `catalogo-${catalogo}-${modo}`,
    titulo,
    versaoDoEsquema: 1,
    passos: [
      { id: "dados", titulo: modo === "arquivar" ? "Motivo" : "Dados", campos },
      { id: "conferir", titulo: "Conferir", campos: [] },
    ],
  };

  const entrada = (v: Valores) =>
    modo === "cadastrar"
      ? { catalogo, nome: v.nome }
      : modo === "editar"
        ? { catalogo, nome: v.nome, id: linha?.id, versao: linha?.versao }
        : { catalogo, id: linha?.id, versao: linha?.versao, motivo: v.motivo };
  const esquema =
    modo === "cadastrar"
      ? esquemaIncluirItem
      : modo === "editar"
        ? esquemaEditarItem
        : esquemaArquivarItem;
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquema.safeParse(entrada(valores));
    // Só os campos da tela entram no resolvedor; id e versão vêm do item e o servidor os confere.
    const problemas = r.success
      ? []
      : r.error.issues.filter((i) => campos.includes(String(i.path[0])));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const acao =
    modo === "cadastrar" ? incluirItemAcao : modo === "editar" ? editarItemAcao : arquivarItemAcao;

  return (
    <Assistente<Valores>
      definicao={definicao}
      resolver={resolver}
      valoresIniciais={{ nome: modo === "editar" ? nomeAtual : "", motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={linha?.id}
      rascunho={modo !== "arquivar"}
      focoFinal={focoFinal}
      rotuloConcluir={titulo}
      mensagemConcluido={`${singular.charAt(0).toUpperCase()}${singular.slice(1)} ${VERBOS[modo].participio}.`}
      aoConcluir={(valores, chaveDeEnvio) => acao({ chaveDeEnvio, dados: entrada(valores) })}
      descreverAtual={() => (
        <p>
          Este item mudou desde que você o abriu. Feche o assistente e abra de novo para ver como
          está.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: modo === "arquivar" ? "Item a arquivar" : "Item",
          linhas: [
            { rotulo: "Catálogo", valor: singular },
            ...(modo === "editar" ? [{ rotulo: "Nome atual", valor: nomeAtual }] : []),
            {
              rotulo: modo === "arquivar" ? "Nome" : "Nome novo",
              valor: modo === "arquivar" ? nomeAtual : v.nome?.trim(),
            },
            ...(modo === "arquivar" ? [{ rotulo: "Motivo", valor: v.motivo?.trim() }] : []),
          ],
        },
      ]}
      efeitos={() =>
        modo === "cadastrar"
          ? [`A ${singular} aparece nas listas e nos campos de escolha.`]
          : modo === "editar"
            ? [`O novo nome vale em todo lugar onde a ${singular} aparece; nada do histórico muda.`]
            : [
                `A ${singular} sai das listas e dos campos de escolha, mas fica no histórico com o motivo.`,
                "Ela volta a aparecer na lista com a opção de incluir arquivados.",
              ]
      }
      renderPasso={(_, form) =>
        modo === "arquivar" ? (
          <Campo
            rotulo="Motivo do arquivamento"
            erro={form.formState.errors.motivo?.message}
            ajuda="O motivo fica registrado junto de quem arquivou e quando."
          >
            {(p) => (
              <textarea
                {...p}
                {...form.register("motivo")}
                rows={3}
                className={`${CLASSE_DO_CAMPO} h-auto py-2 max-sm:h-auto`}
              />
            )}
          </Campo>
        ) : (
          <Campo rotulo={`Nome da ${singular}`} erro={form.formState.errors.nome?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("nome")}
                autoComplete="off"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        )
      }
    />
  );
}
