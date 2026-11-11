"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ErroDeCarregamento } from "@/components/tabela/estados";
import { detalheDoErroDeLeitura } from "@/lib/erros/detalhe-do-erro";
import { lerDigest, type CausaDaFalha, type DetalheTecnico } from "@/lib/erros/leitura";

/** O que dizer em cada causa: o que houve e o próximo passo, sem pedir desculpas. */
export const TEXTO_DA_CAUSA: Record<CausaDaFalha, string> = {
  funcao_ausente:
    "O banco está desatualizado e falta uma função que esta tela usa. Aplique as migrations e tente de novo.",
  banco_fora: "O banco não respondeu. Tente de novo em instantes.",
  lenta:
    "A consulta demorou mais que o limite. Tente de novo em instantes; se continuar, reduza o período ou o filtro.",
  sem_permissao: "Você não tem permissão para ver isto. Peça acesso a quem administra o sistema.",
  inesperado:
    "Aconteceu um erro inesperado ao carregar. Tente de novo; se continuar, avise quem cuida do sistema.",
};

interface Props {
  /** O erro do `error.tsx` da rota. A causa vem decidida pelo servidor, no `digest`. */
  error: Error & { digest?: string };
  reset: () => void;
  /** Complemento de "Não foi possível carregar ...": "as operações", "a ficha". */
  oQue: string;
  /** Com título, a tela continua com o esqueleto de leitura (título e descrição). */
  titulo?: string;
  descricao?: string;
  /** Fichas: o caminho de volta, acima do erro (sem título de página). */
  topo?: ReactNode;
}

/**
 * O componente único de erro de leitura de todas as rotas. Mensagem curta por causa e o botão "Tentar de
 * novo". A função e o código do erro só aparecem para Administrador e Diretoria: o servidor decide
 * (detalheDoErroDeLeitura devolve nulo aos outros perfis), esta tela nunca os recebe.
 */
export function ErroDeLeitura({ error, reset, oQue, titulo, descricao, topo }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const lido = lerDigest(error.digest);
  const causa = lido?.causa ?? "inesperado";
  const id = lido?.id;
  const [detalhe, setDetalhe] = useState<DetalheTecnico | null>(null);

  useEffect(() => {
    if (!id) return;
    let vale = true;
    detalheDoErroDeLeitura({ id })
      .then((d) => {
        if (vale) setDetalhe(d);
      })
      .catch(() => undefined);
    return () => {
      vale = false;
    };
  }, [id]);

  const corpo = (
    <ErroDeCarregamento
      titulo={`Não foi possível carregar ${oQue}`}
      descricao={TEXTO_DA_CAUSA[causa]}
      codigo={
        detalhe
          ? `${detalhe.funcao}${detalhe.codigo ? `, ${detalhe.codigo}` : ""}`
          : lido
            ? undefined
            : error.digest
      }
      pendente={pendente}
      aoTentar={() =>
        iniciar(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
  if (titulo) {
    return (
      <PaginaDeLeitura titulo={titulo} descricao={descricao}>
        {corpo}
      </PaginaDeLeitura>
    );
  }
  return topo ? (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      <div>{topo}</div>
      {corpo}
    </div>
  ) : (
    corpo
  );
}
