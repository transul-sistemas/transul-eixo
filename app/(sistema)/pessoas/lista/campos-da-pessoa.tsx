"use client";

import type { FieldErrors, FieldValues, Resolver, UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { formatarData } from "@/components/formato/data";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { OperacaoParaEscolher } from "@/lib/dados/pessoas-tipos";
import { FUNCOES_DA_PESSOA } from "@/lib/dominio/esquemas/pessoa";

// O que os assistentes "Cadastrar pessoa" e "Editar pessoa" dividem: os campos do vínculo (operação,
// função e a data), o resolvedor pelo esquema Zod da tela e o texto do vínculo no resumo.

export interface ValoresDoVinculo {
  operacaoId: string;
  funcao: string;
  inicio: string;
}

/** O resolvedor do React Hook Form pelo mesmo esquema do servidor, só com os campos da tela. */
export function resolvedorPor<V extends FieldValues>(
  esquema: z.ZodType,
  campos: readonly string[],
  entrada: (v: V) => unknown = (v) => v,
): Resolver<V> {
  return async (valores) => {
    const r = esquema.safeParse(entrada(valores));
    const problemas = r.success
      ? []
      : r.error.issues.filter((i) => campos.includes(String(i.path[0])));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<V>(problemas) as FieldErrors<V> };
  };
}

export function nomeDaFuncao(funcao: string | undefined): string | undefined {
  return FUNCOES_DA_PESSOA.find((f) => f.id === funcao)?.nome;
}

export function textoDoVinculo(
  v: Partial<ValoresDoVinculo>,
  operacoes: readonly OperacaoParaEscolher[],
): string {
  if (!v.operacaoId) return "Sem vínculo com operação";
  const operacao = operacoes.find((o) => o.id === v.operacaoId)?.nome ?? "operação escolhida";
  const funcao = nomeDaFuncao(v.funcao) ?? "função a escolher";
  return `${funcao} em ${operacao}${v.inicio ? `, desde ${formatarData(v.inicio)}` : ""}`;
}

/** Os campos do vínculo. Sem operação, a pessoa fica sem vínculo (a função e a data não contam). */
export function CamposDoVinculo<V extends ValoresDoVinculo>({
  form,
  operacoes,
  rotuloDaData,
  ajudaDaData,
}: {
  form: UseFormReturn<V>;
  operacoes: readonly OperacaoParaEscolher[];
  rotuloDaData: string;
  ajudaDaData?: string;
}) {
  // O formulário é genérico; os três campos existem em todo V que estende ValoresDoVinculo.
  const f = form as unknown as UseFormReturn<ValoresDoVinculo>;
  const erros = f.formState.errors;
  return (
    <>
      <Campo rotulo="Operação" erro={erros.operacaoId?.message}>
        {(p) => (
          <select {...p} {...f.register("operacaoId")} className={CLASSE_DO_CAMPO}>
            <option value="">Sem vínculo com operação</option>
            {operacoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo rotulo="Função" erro={erros.funcao?.message}>
        {(p) => (
          <select {...p} {...f.register("funcao")} className={CLASSE_DO_CAMPO}>
            <option value="">Escolha a função</option>
            {FUNCOES_DA_PESSOA.map((funcao) => (
              <option key={funcao.id} value={funcao.id}>
                {funcao.nome}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo rotulo={rotuloDaData} erro={erros.inicio?.message} ajuda={ajudaDaData}>
        {(p) => <input {...p} {...f.register("inicio")} type="date" className={CLASSE_DO_CAMPO} />}
      </Campo>
    </>
  );
}
