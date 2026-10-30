"use client";

import { IconArrowsMaximize, IconArrowsMinimize } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { cn } from "@/lib/utils";
import { useLista } from "./pendencia-da-lista";

// Modo foco: a barra lateral e o topo somem e a tabela ocupa a tela. Mora na URL (`?foco=1`), então
// recarregar e compartilhar devolvem a mesma visão, e Voltar sai do modo foco. Esc também sai.

const botao =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 aria-disabled:opacity-60";

export function ModoFoco() {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const lista = useLista();
  const emFoco = parametros.get("foco") === "1";

  function alternar(ligar: boolean) {
    if (lista?.pendente) return; // aria-disabled não bloqueia o clique: a guarda é aqui
    const novos = new URLSearchParams(parametros.toString());
    if (ligar) novos.set("foco", "1");
    else novos.delete("foco");
    const texto = novos.toString();
    const ir = () => router.push(texto ? `${rota}?${texto}` : rota, { scroll: false });
    if (lista) lista.iniciar(ir);
    else ir();
  }

  const sairComEsc = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.key !== "Escape" || evento.defaultPrevented) return;
    // Menu aberto (Colunas, busca rápida): o Esc é dele e fecha só ele.
    if (document.querySelector('[role="dialog"]')) return;
    alternar(false);
  });
  useEffect(() => {
    if (!emFoco) return;
    const ouvinte = (evento: KeyboardEvent) => sairComEsc(evento);
    document.addEventListener("keydown", ouvinte);
    return () => document.removeEventListener("keydown", ouvinte);
  }, [emFoco]);

  return (
    <button
      type="button"
      aria-pressed={emFoco}
      aria-disabled={lista?.pendente ? true : undefined}
      onClick={() => alternar(!emFoco)}
      className={cn(botao, emFoco && "bg-primary text-primary-foreground hover:bg-primary/90")}
    >
      {emFoco ? (
        <IconArrowsMinimize aria-hidden className="size-4" />
      ) : (
        <IconArrowsMaximize aria-hidden className="size-4" />
      )}
      {emFoco ? "Sair do modo foco" : "Modo foco"}
    </button>
  );
}
