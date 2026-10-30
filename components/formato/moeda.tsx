"use client";

import { type ChangeEvent, type ClipboardEvent, type KeyboardEvent, useId } from "react";
import { cn } from "@/lib/utils";
import {
  centavosDoTextoColado,
  formatarMoeda,
  MAXIMO_DE_DIGITOS,
  proximoValorDoCampo,
} from "./moeda-valor";

/** Valor na tela (recebe centavos): com centavos, à direita, algarismos de largura fixa, negativo em vermelho. */
export function Moeda({
  valor,
  className,
}: {
  valor: number | null | undefined;
  className?: string;
}) {
  const negativo = typeof valor === "number" && valor < 0 && Math.round(Math.abs(valor)) > 0;
  return (
    <span
      data-negativo={negativo ? "" : undefined}
      className={cn("block text-right tabular-nums", negativo && "text-texto-negativo", className)}
    >
      {formatarMoeda(valor)}
    </span>
  );
}

/** Campo de digitação de reais: preenche a partir dos centavos. */
export function CampoMoeda({
  valor,
  onChange,
  rotulo,
  className,
}: {
  valor: number;
  onChange: (centavos: number) => void;
  rotulo: string;
  className?: string;
}) {
  const id = useId();

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (/^\d$/.test(evento.key) || evento.key === "Backspace") {
      evento.preventDefault();
      onChange(proximoValorDoCampo(valor, evento.key));
    }
  }

  // Teclados de celular não mandam a tecla; o texto novo traz os dígitos.
  function aoMudar(evento: ChangeEvent<HTMLInputElement>) {
    const digitos = evento.target.value.replace(/\D/g, "");
    if (digitos.length <= MAXIMO_DE_DIGITOS) onChange(centavosDoTextoColado(digitos));
  }

  function aoColar(evento: ClipboardEvent<HTMLInputElement>) {
    evento.preventDefault();
    onChange(centavosDoTextoColado(evento.clipboardData.getData("text")));
  }

  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={formatarMoeda(valor)}
        onKeyDown={aoTeclar}
        onChange={aoMudar}
        onPaste={aoColar}
        className={cn(
          "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 text-right tabular-nums outline-none focus-visible:ring-3",
          className,
        )}
      />
    </label>
  );
}
