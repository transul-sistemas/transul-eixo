"use client";

import { IconPlus } from "@tabler/icons-react";
import { type ReactNode, type RefObject, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** As classes dos campos de texto, número e seleção dos assistentes (só tokens do sistema visual). */
export const CLASSE_DO_CAMPO =
  "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-10 w-full rounded-[10px] border px-3 text-sm outline-none focus-visible:ring-3 max-sm:h-11";

/**
 * Um campo do assistente: rótulo, o controle e a mensagem de erro ligada a ele (`aria-describedby`,
 * `aria-invalid`). O controle recebe o `id` e as propriedades de acessibilidade por uma função.
 */
export function Campo({
  rotulo,
  erro,
  ajuda,
  children,
}: {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  children: (propriedades: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const idDoErro = `${id}-erro`;
  const idDaAjuda = `${id}-ajuda`;
  const descritoPor = [erro ? idDoErro : null, ajuda ? idDaAjuda : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        {rotulo}
      </label>
      {children({
        id,
        "aria-invalid": erro ? true : undefined,
        "aria-describedby": descritoPor || undefined,
      })}
      {ajuda ? (
        <p id={idDaAjuda} className="text-muted-foreground text-xs">
          {ajuda}
        </p>
      ) : null}
      {/* Sempre presente, com altura reservada: a mensagem que aparece ao sair de um campo vazio não
          empurra o botão que a pessoa está clicando (o clique se perderia entre apertar e soltar). */}
      <p id={idDoErro} role="alert" className="text-destructive min-h-4 text-xs">
        {erro}
      </p>
    </div>
  );
}

/** Dois campos lado a lado a partir de 640 px; em uma coluna abaixo disso. */
export function GradeDeCampos({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>;
}

export interface OpcaoDeSelecao {
  id: string;
  nome: string;
}

/**
 * Campo de seleção com o "+": quando falta a opção, o botão ao lado abre um mini-wizard em popup
 * central empilhado e devolve o campo preenchido com o que foi criado. Esc fecha só o mini, e o foco volta ao "+".
 */
export function CampoComMais({
  rotulo,
  rotuloDoMais,
  opcoes,
  valor,
  aoMudar,
  erro,
  semOpcao,
  desligadoPorque,
  renderMini,
}: {
  rotulo: string;
  /** O que o botão "+" faz, no mesmo nome do mini-wizard ("Cadastrar categoria"). */
  rotuloDoMais: string;
  opcoes: readonly OpcaoDeSelecao[];
  valor: string;
  aoMudar: (id: string) => void;
  erro?: string;
  /** Texto de ajuda quando não há nenhuma opção. */
  semOpcao?: string;
  /** Por que o "+" ainda não pode ser usado (por exemplo, falta escolher a marca): desliga o botão e diz o motivo. */
  desligadoPorque?: string;
  renderMini: (mini: {
    /** Chame com a opção criada: o campo passa a ter essa opção e ela vem escolhida. */
    aoCriar: (opcao: OpcaoDeSelecao) => void;
    aoFechar: () => void;
    focoFinal: RefObject<HTMLElement | null>;
  }) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  return (
    <Campo
      rotulo={rotulo}
      erro={erro}
      ajuda={desligadoPorque ?? (opcoes.length === 0 ? semOpcao : undefined)}
    >
      {(propriedades) => (
        <div className="flex items-center gap-2">
          <select
            {...propriedades}
            value={valor}
            onChange={(evento) => aoMudar(evento.target.value)}
            className={cn(CLASSE_DO_CAMPO, "flex-1")}
          >
            <option value="">Escolha…</option>
            {opcoes.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.nome}
              </option>
            ))}
          </select>
          <button
            ref={botao}
            type="button"
            aria-label={rotuloDoMais}
            title={desligadoPorque ? `${rotuloDoMais}. ${desligadoPorque}` : rotuloDoMais}
            aria-haspopup="dialog"
            aria-disabled={desligadoPorque ? true : undefined}
            onClick={() => {
              if (!desligadoPorque) setAberto(true);
            }}
            className="hover:bg-muted focus-visible:ring-ring/50 grid size-10 shrink-0 place-items-center rounded-[10px] border border-dashed border-[var(--acao)] bg-[var(--acao-suave)] text-[var(--acao)] outline-none focus-visible:ring-3 aria-disabled:cursor-default aria-disabled:opacity-50 max-sm:size-11"
          >
            <IconPlus aria-hidden className="size-4" />
          </button>
          {aberto
            ? renderMini({
                aoCriar: (opcao) => aoMudar(opcao.id),
                aoFechar: () => setAberto(false),
                focoFinal: botao,
              })
            : null}
        </div>
      )}
    </Campo>
  );
}
