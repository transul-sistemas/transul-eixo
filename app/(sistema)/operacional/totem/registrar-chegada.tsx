"use client";

import { useState, useTransition } from "react";
import { formatarDataEHora } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { Button } from "@/components/ui/button";
import type { ChegadaRegistrada } from "@/lib/dados/operacional-tipos";
import { esquemaRegistrarChegada } from "@/lib/dominio/esquemas/operacional";
import { novaChaveDeEnvio } from "@/lib/wizard/chave-de-envio";
import { MENSAGENS_PADRAO } from "@/lib/wizard/resultado";
import { registrarChegadaAcao } from "../acoes";

// O Totem: tela grande e simples para o motorista. Digita a placa, registra a chegada e vê a posição
// na fila da filial. A chave de envio nasce com cada placa: o toque duplo e "tentar de novo" mandam a
// mesma chave e o banco grava uma vez só.

export function RegistrarChegada() {
  const [placa, setPlaca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [chegada, setChegada] = useState<ChegadaRegistrada | null>(null);
  const [chave, setChave] = useState(() => novaChaveDeEnvio());
  const [pendente, iniciar] = useTransition();

  const registrar = () => {
    if (pendente) return;
    const dados = esquemaRegistrarChegada.safeParse({ placa });
    if (!dados.success) {
      setErro(dados.error.issues[0]?.message ?? MENSAGENS_PADRAO.entrada_invalida);
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await registrarChegadaAcao({ chaveDeEnvio: chave, dados: { placa } });
      if (r.ok) {
        setChegada(r.linha);
        setPlaca("");
        setChave(novaChaveDeEnvio());
      } else {
        setErro(r.erro.mensagem);
      }
    });
  };

  if (chegada) {
    return (
      <section
        aria-live="polite"
        data-testid="chegada-registrada"
        className="border-border bg-card flex flex-col items-center gap-5 rounded-2xl border px-6 py-10 text-center"
      >
        <Placa placa={chegada.placa} tamanho="g" />
        <p className="text-2xl font-semibold">
          {chegada.jaEstava ? "Você já está na fila." : "Chegada registrada."}
        </p>
        {chegada.posicao ? (
          <p className="text-5xl font-bold tabular-nums">
            {formatarInteiro(chegada.posicao)}º na fila
          </p>
        ) : null}
        <p className="text-muted-foreground text-lg">
          {chegada.filial} · chegada em {formatarDataEHora(chegada.chegouEm)}
        </p>
        <Button size="lg" className="h-14 px-8 text-lg" onClick={() => setChegada(null)}>
          Registrar outra placa
        </Button>
      </section>
    );
  }

  return (
    <form
      className="border-border bg-card flex flex-col gap-5 rounded-2xl border px-6 py-10"
      onSubmit={(evento) => {
        evento.preventDefault();
        registrar();
      }}
    >
      <label className="flex flex-col gap-3 text-center">
        <span className="text-2xl font-semibold">Digite a placa do caminhão</span>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          value={placa}
          onChange={(evento) => setPlaca(evento.target.value.toUpperCase())}
          aria-invalid={erro ? true : undefined}
          aria-describedby="erro-do-totem"
          className="border-input bg-background font-placa mx-auto h-20 w-full max-w-md rounded-xl border-2 text-center text-4xl tracking-widest uppercase"
        />
      </label>
      <p id="erro-do-totem" role="alert" className="text-destructive min-h-6 text-center text-lg">
        {erro}
      </p>
      <Button
        type="submit"
        size="lg"
        disabled={pendente}
        className="mx-auto h-16 w-full max-w-md text-xl"
      >
        {pendente ? "Registrando…" : "Registrar chegada"}
      </Button>
    </form>
  );
}
