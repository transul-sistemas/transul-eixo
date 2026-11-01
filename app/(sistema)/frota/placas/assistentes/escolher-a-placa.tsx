"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";

/**
 * Receber placa ou Disponibilizar abertos sem placa (pelo Ctrl+K): pergunta qual placa antes de abrir
 * o assistente. Sem placa possível, diz por que e como resolver.
 */
export function EscolherAPlaca({
  titulo,
  opcoes,
  vazio,
  aoEscolher,
  aoFechar,
}: {
  titulo: string;
  opcoes: readonly { placa: string; nome: string }[];
  vazio: string;
  aoEscolher: (placa: string) => void;
  aoFechar: () => void;
}) {
  const [escolhida, setEscolhida] = useState("");
  return (
    <Dialog.Root open onOpenChange={(aberto) => (aberto ? undefined : aoFechar())} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
        <Dialog.Popup
          data-assistente="escolher-a-placa"
          className="bg-background border-border fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg outline-none"
        >
          <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
          {opcoes.length === 0 ? (
            <>
              <Dialog.Description className="text-muted-foreground text-sm">
                {vazio}
              </Dialog.Description>
              <div className="flex justify-end">
                <Button autoFocus onClick={aoFechar}>
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (escolhida) aoEscolher(escolhida);
              }}
            >
              <Dialog.Description className="text-muted-foreground text-sm">
                Escolha a placa para continuar.
              </Dialog.Description>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Escolher a placa</span>
                <select
                  autoFocus
                  value={escolhida}
                  onChange={(e) => setEscolhida(e.target.value)}
                  className={CLASSE_DO_CAMPO}
                >
                  <option value="">Escolha…</option>
                  {opcoes.map((o) => (
                    <option key={o.placa} value={o.placa}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={aoFechar}>
                  Cancelar
                </Button>
                <Button type="submit" aria-disabled={escolhida ? undefined : true}>
                  Continuar
                </Button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
