"use client";

import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ResultadoDaAcao } from "@/lib/wizard/resultado";

// O assistente que precisa de um dado do banco antes de abrir (os vínculos da placa para Trocar CR, o
// impacto da baixa): um popup central curto com carregando, erro ("Tentar de novo") e vazio (com o que
// fazer); com o dado na mão, desenha o assistente.

type Leitura<T> =
  { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; dado: T };

export function AvisoDoAssistente({
  titulo,
  texto,
  aoFechar,
  aoRepetir,
  empilhado = false,
}: {
  titulo: string;
  texto: string;
  aoFechar: () => void;
  aoRepetir?: () => void;
  empilhado?: boolean;
}) {
  const z = empilhado ? "z-[60]" : "z-50";
  return (
    <Dialog.Root open onOpenChange={(aberto) => (aberto ? undefined : aoFechar())} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className={`bg-foreground/40 fixed inset-0 ${z}`} />
        <Dialog.Popup
          data-aviso-do-assistente=""
          className={`bg-background border-border fixed top-1/2 left-1/2 ${z} flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border p-5 shadow-lg outline-none`}
        >
          <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground text-sm" role="status">
            {texto}
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            {aoRepetir ? <Button onClick={aoRepetir}>Tentar de novo</Button> : null}
            <Button variant="outline" onClick={aoFechar}>
              Fechar
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CarregarParaAbrir<T>({
  titulo,
  ler,
  vazio,
  aoFechar,
  children,
}: {
  titulo: string;
  ler: () => Promise<ResultadoDaAcao<T>>;
  /** O texto quando o dado não serve (nulo: serve). */
  vazio?: (dado: T) => string | null;
  aoFechar: () => void;
  children: (dado: T) => ReactNode;
}) {
  const [leitura, setLeitura] = useState<Leitura<T>>({ tipo: "carregando" });
  // A leitura de quando abriu (quem chama passa uma função nova a cada desenho).
  const [lerAoAbrir] = useState(() => ler);
  const carregar = useCallback(async () => {
    setLeitura({ tipo: "carregando" });
    const r = await lerAoAbrir().catch(() => null);
    if (r?.ok) setLeitura({ tipo: "pronto", dado: r.linha });
    else
      setLeitura({
        tipo: "erro",
        mensagem: r?.erro.mensagem ?? "Não foi possível carregar agora. Tente de novo.",
      });
  }, [lerAoAbrir]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o dado vem de fora (Server Action)
    void carregar();
  }, [carregar]);
  if (leitura.tipo === "carregando")
    return <AvisoDoAssistente titulo={titulo} texto="Carregando…" aoFechar={aoFechar} />;
  if (leitura.tipo === "erro")
    return (
      <AvisoDoAssistente
        titulo={titulo}
        texto={leitura.mensagem}
        aoFechar={aoFechar}
        aoRepetir={() => void carregar()}
      />
    );
  const motivo = vazio?.(leitura.dado) ?? null;
  if (motivo !== null)
    return <AvisoDoAssistente titulo={titulo} texto={motivo} aoFechar={aoFechar} />;
  return <>{children(leitura.dado)}</>;
}
