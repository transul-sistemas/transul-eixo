"use client";

import { IconPlus } from "@tabler/icons-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import { Button } from "@/components/ui/button";
import type { DefinicaoDoCatalogo, LinhaDoCatalogo } from "@/lib/dados/catalogos-definicoes";
import type { CatalogoEditavel } from "@/lib/dominio/esquemas/cadastro";
import { AssistenteDoItem, type ModoDoItem, textoDoBotao } from "./assistente-do-item";

// A tabela de um catálogo com os botões do assistente: cadastrar (no alto), editar e arquivar (em cada
// linha). Só aparece o botão que a pessoa pode usar; o servidor e o banco conferem de novo.

const ORDEM_FIXA = { campo: "nome", sentido: "asc" } as const;
const SEM_ORDEM = () => {};

export function CatalogoInterativo({
  definicao,
  editavel,
  linhas,
  permissoes,
  usuario,
  vazio,
}: {
  definicao: DefinicaoDoCatalogo;
  /** O catálogo que o assistente edita; nulo é só leitura. */
  editavel: CatalogoEditavel | null;
  linhas: readonly LinhaDoCatalogo[];
  permissoes: { criar: boolean; editar: boolean; arquivar: boolean };
  /** Quem usa: a chave dos rascunhos. */
  usuario: string;
  /** O que mostrar no lugar da tabela quando não há linha. */
  vazio: ReactNode;
}) {
  const [aberto, setAberto] = useState<{ modo: ModoDoItem; linha?: LinhaDoCatalogo } | null>(null);
  const botaoDeCadastrar = useRef<HTMLButtonElement>(null);

  const colunas = useMemo<readonly ColunaDeTabela<LinhaDoCatalogo>[]>(() => {
    const doCatalogo = definicao.colunas.map((c, i): ColunaDeTabela<LinhaDoCatalogo> => ({
      id: c.id,
      titulo: c.titulo,
      cabecalhoDeLinha: i === 0,
      celula: (l) =>
        l.celulas[c.id] === "" ? <span className="text-muted-foreground">-</span> : l.celulas[c.id],
    }));
    const situacao: ColunaDeTabela<LinhaDoCatalogo>[] = definicao.comArquivo
      ? [
          {
            id: "situacao",
            titulo: "Situação",
            celula: (l) =>
              l.arquivado ? (
                <Etiqueta status="fora" titulo={l.motivo ?? undefined}>
                  Arquivado
                </Etiqueta>
              ) : (
                <Etiqueta status="em-atividade">Ativo</Etiqueta>
              ),
          },
        ]
      : [];
    const acoes: ColunaDeTabela<LinhaDoCatalogo>[] =
      editavel && (permissoes.editar || permissoes.arquivar)
        ? [
            {
              id: "acoes",
              titulo: "Ações",
              classe: "text-right",
              celula: (l) =>
                l.arquivado ? null : (
                  <span className="inline-flex gap-1">
                    {permissoes.editar ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAberto({ modo: "editar", linha: l })}
                      >
                        {textoDoBotao("editar", editavel)}
                      </Button>
                    ) : null}
                    {permissoes.arquivar ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAberto({ modo: "arquivar", linha: l })}
                      >
                        {textoDoBotao("arquivar", editavel)}
                      </Button>
                    ) : null}
                  </span>
                ),
            },
          ]
        : [];
    return [...doCatalogo, ...situacao, ...acoes];
  }, [definicao, editavel, permissoes.arquivar, permissoes.editar]);

  return (
    <ProvedorDoUsuario usuario={usuario}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {editavel ? (
          <div className="flex items-center justify-end gap-2">
            {permissoes.criar ? (
              <Button
                ref={botaoDeCadastrar}
                onClick={() => setAberto({ modo: "cadastrar" })}
                aria-haspopup="dialog"
              >
                <IconPlus data-icon="inline-start" />
                {textoDoBotao("cadastrar", editavel)}
              </Button>
            ) : null}
          </div>
        ) : definicao.somenteLeituraPorque ? (
          <p data-testid="somente-leitura" className="text-muted-foreground text-sm">
            Só leitura. {definicao.somenteLeituraPorque}
          </p>
        ) : null}
        {linhas.length === 0 ? (
          vazio
        ) : (
          <TabelaDeDados
            rotulo={definicao.nome}
            colunas={colunas}
            linhas={linhas}
            idDaLinha={(l) => l.chave}
            ordem={ORDEM_FIXA}
            aoOrdenar={SEM_ORDEM}
            densidade="confortavel"
          />
        )}
      </div>
      {aberto && editavel ? (
        <AssistenteDoItem
          key={`${aberto.modo}-${aberto.linha?.id ?? "novo"}`}
          modo={aberto.modo}
          catalogo={editavel}
          linha={aberto.linha}
          aoFechar={() => setAberto(null)}
          focoFinal={aberto.modo === "cadastrar" ? botaoDeCadastrar : undefined}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
