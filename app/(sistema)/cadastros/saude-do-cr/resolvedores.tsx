"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import type { FieldValues, Resolver, UseFormReturn } from "react-hook-form";
import { formatarData, hojeEmSaoPaulo } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { CrDoCatalogo, OpcaoDoCatalogo } from "@/lib/dados/escrita-tipos";
import type { LinhaDoProblema, ProblemaDaSaude } from "@/lib/dados/saude-do-cr-tipos";
import {
  esquemaAtribuirDono,
  esquemaClassificarCentro,
  esquemaEncerrarVinculo,
  esquemaLigarCr,
} from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import type { ResultadoDaAcao } from "@/lib/wizard/resultado";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { TrocarCr } from "../../frota/placas/assistentes/trocar-cr";
import { atribuirDonoAcao, classificarCentroAcao, encerrarVinculoAcao, ligarCrAcao } from "./acoes";

// Os resolvedores da Saúde do CR, um por problema, abertos pelo botão "O que fazer" da linha (e o 29,
// "Atribuir dono", para toda linha). Todos em popup central, com Conferir e o mesmo nome do começo ao fim.
// Nunca funde sozinho; encerrar não é excluir; o fato do Sankhya não é editado.

type Validacao = {
  success: boolean;
  error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
};

function resolvedor<V extends FieldValues>(validar: (v: V) => Validacao): Resolver<V> {
  return async (valores) => {
    const r = validar(valores);
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<V>(
            (r.error?.issues ?? []).map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
}

function AssistenteDeUmPasso<V extends FieldValues>({
  id,
  titulo,
  passo,
  campos,
  registro,
  valoresIniciais,
  validar,
  enviar,
  resumo,
  efeitos,
  render,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  id: string;
  titulo: string;
  passo: string;
  campos: string[];
  registro: string;
  valoresIniciais: V;
  validar: (v: V) => Validacao;
  enviar: (v: V, chave: string) => Promise<ResultadoDaAcao<unknown, unknown>>;
  resumo: (v: V) => { rotulo: string; valor: string }[];
  efeitos: string[];
  render: (form: UseFormReturn<V>) => ReactNode;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const definicao: DefinicaoDeAssistente = {
    id,
    titulo,
    versaoDoEsquema: 1,
    passos: [
      { id: "dados", titulo: passo, campos },
      { id: "conferir", titulo: "Conferir", campos: [] },
    ],
  };
  return (
    <Assistente<V>
      definicao={definicao}
      resolver={resolvedor(validar)}
      valoresIniciais={valoresIniciais}
      validarRascunho={() => null}
      usuario={usuario}
      registro={registro}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir={titulo}
      mensagemConcluido="Problema tratado. A lista atualiza sozinha."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={enviar}
      aoFechar={aoFechar}
      resumo={(v) => [{ titulo, linhas: resumo(v) }]}
      efeitos={() => efeitos}
      renderPasso={(_, form) => render(form)}
    />
  );
}

const hoje = () => hojeEmSaoPaulo(new Date());

/** O botão do assistente da linha (25 a 28) e o "Atribuir dono" (29). */
export function AcoesDaLinha({
  problema,
  linha,
  crs,
  operacoes,
  pessoas,
}: {
  problema: ProblemaDaSaude;
  linha: LinhaDoProblema;
  crs: readonly CrDoCatalogo[];
  operacoes: readonly OpcaoDoCatalogo[];
  pessoas: readonly OpcaoDoCatalogo[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<"resolver" | "dono" | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const botaoDoDono = useRef<HTMLButtonElement>(null);
  const comum = {
    aoFechar: () => setAberto(null),
    aoGravar: () => router.refresh(),
  };
  const referencia =
    linha.ativo_id ?? linha.cr_id ?? (linha.codcencus != null ? String(linha.codcencus) : "");
  const rotulo: Record<ProblemaDaSaude, string> = {
    placa_sem_cr: "Escolher o CR",
    cr_sem_operacao: "Ligar à operação",
    dois_do_mesmo_tipo: "Escolher o vigente",
    lancamento_sem_cr: "Classificar",
  };
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button ref={botao} size="sm" aria-haspopup="dialog" onClick={() => setAberto("resolver")}>
        {rotulo[problema]}
      </Button>
      <Button
        ref={botaoDoDono}
        size="sm"
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => setAberto("dono")}
      >
        Atribuir dono
      </Button>

      {aberto === "resolver" && problema === "placa_sem_cr" && linha.placa ? (
        <TrocarCr placa={linha.placa} crs={crs} aoFechar={comum.aoFechar} focoFinal={botao} />
      ) : null}

      {aberto === "resolver" && problema === "cr_sem_operacao" && linha.cr_id ? (
        <AssistenteDeUmPasso<{ operacaoId: string; dia: string; motivo: string }>
          id="ligar-cr"
          titulo="Ligar à operação"
          passo="Operação, data e motivo"
          campos={["operacaoId", "dia", "motivo"]}
          registro={linha.cr_id}
          valoresIniciais={{ operacaoId: "", dia: hoje(), motivo: "" }}
          validar={(v) => esquemaLigarCr.safeParse({ crId: linha.cr_id, ...v })}
          enviar={(v, chave) =>
            ligarCrAcao({ chaveDeEnvio: chave, dados: { crId: linha.cr_id, ...v } })
          }
          resumo={(v) => [
            { rotulo: "CR", valor: linha.codigo ?? "" },
            { rotulo: "Operação", valor: operacoes.find((o) => o.id === v.operacaoId)?.nome ?? "" },
            { rotulo: "Desde", valor: v.dia ? formatarData(v.dia) : "" },
          ]}
          efeitos={[
            "O CR passa a servir a operação a partir da data, com vigência (início sem fim).",
            "As placas do CR passam a contar na operação a partir dessa data.",
          ]}
          render={(form) => (
            <>
              <Campo rotulo="Operação" erro={form.formState.errors.operacaoId?.message}>
                {(p) => (
                  <select {...p} {...form.register("operacaoId")} className={CLASSE_DO_CAMPO}>
                    <option value="">Escolha…</option>
                    {operacoes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Desde" erro={form.formState.errors.dia?.message}>
                {(p) => (
                  <input {...p} {...form.register("dia")} type="date" className={CLASSE_DO_CAMPO} />
                )}
              </Campo>
              <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
                {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
              </Campo>
            </>
          )}
          focoFinal={botao}
          {...comum}
        />
      ) : null}

      {aberto === "resolver" && problema === "dois_do_mesmo_tipo" ? (
        <AssistenteDeUmPasso<{ vinculoId: string; dia: string; motivo: string }>
          id="escolher-o-vigente"
          titulo="Escolher o vigente"
          passo="Qual encerra, quando e por quê"
          campos={["vinculoId", "dia", "motivo"]}
          registro={referencia}
          valoresIniciais={{ vinculoId: "", dia: hoje(), motivo: "" }}
          validar={(v) => {
            const vinculo = linha.crs?.find((c) => c.vinculo_id === v.vinculoId);
            if (!vinculo)
              return {
                success: false,
                error: { issues: [{ path: ["vinculoId"], message: "Escolha o CR que encerra." }] },
              };
            return esquemaEncerrarVinculo.safeParse({ ...v, versao: vinculo.versao });
          }}
          enviar={(v, chave) =>
            encerrarVinculoAcao({
              chaveDeEnvio: chave,
              dados: {
                ...v,
                versao: linha.crs?.find((c) => c.vinculo_id === v.vinculoId)?.versao ?? 0,
              },
            })
          }
          resumo={(v) => [
            { rotulo: "Placa", valor: linha.placa ?? "" },
            {
              rotulo: "Encerra",
              valor: linha.crs?.find((c) => c.vinculo_id === v.vinculoId)?.codigo ?? "",
            },
            { rotulo: "Em", valor: v.dia ? formatarData(v.dia) : "" },
          ]}
          efeitos={[
            "O CR escolhido encerra na data (vermelho suave, com rótulo); o outro segue vigente.",
            "Encerrar não é excluir: a história guarda as duas vigências.",
          ]}
          render={(form) => (
            <>
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="mb-2">Qual CR de {linha.placa} encerra?</legend>
                {(linha.crs ?? []).map((c) => (
                  <label key={c.vinculo_id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      value={c.vinculo_id}
                      className="size-4"
                      {...form.register("vinculoId")}
                    />
                    <span className="font-medium">{c.codigo}</span>
                    <span className="text-muted-foreground">desde {formatarData(c.inicio)}</span>
                  </label>
                ))}
                <p role="alert" className="text-destructive min-h-4 text-xs">
                  {form.formState.errors.vinculoId?.message}
                </p>
              </fieldset>
              <Campo rotulo="Encerra em" erro={form.formState.errors.dia?.message}>
                {(p) => (
                  <input {...p} {...form.register("dia")} type="date" className={CLASSE_DO_CAMPO} />
                )}
              </Campo>
              <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
                {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
              </Campo>
            </>
          )}
          focoFinal={botao}
          {...comum}
        />
      ) : null}

      {aberto === "resolver" && problema === "lancamento_sem_cr" ? (
        <AssistenteDeUmPasso<{
          decisao: "criar_cr" | "sem_destino" | "";
          codigo: string;
          nome: string;
          motivo: string;
        }>
          id="classificar-centro"
          titulo="Classificar"
          passo="O que fazer com o centro"
          campos={["decisao", "codigo", "nome", "motivo"]}
          registro={referencia}
          valoresIniciais={{ decisao: "", codigo: "", nome: "", motivo: "" }}
          validar={(v) =>
            esquemaClassificarCentro.safeParse({
              codcencus: String(linha.codcencus ?? ""),
              decisao: v.decisao,
              codigo: v.codigo.trim() === "" ? null : v.codigo,
              nome: v.nome.trim() === "" ? null : v.nome,
              motivo: v.motivo,
            })
          }
          enviar={(v, chave) =>
            classificarCentroAcao({
              chaveDeEnvio: chave,
              dados: {
                codcencus: String(linha.codcencus ?? ""),
                decisao: v.decisao,
                codigo: v.codigo.trim() === "" ? null : v.codigo,
                nome: v.nome.trim() === "" ? null : v.nome,
                motivo: v.motivo,
              },
            })
          }
          resumo={(v) => [
            { rotulo: "Centro (CODCENCUS)", valor: String(linha.codcencus ?? "") },
            {
              rotulo: "Decisão",
              valor:
                v.decisao === "criar_cr"
                  ? `Criar o CR ${v.codigo}`
                  : v.decisao === "sem_destino"
                    ? "Sem destino"
                    : "",
            },
          ]}
          efeitos={[
            "Os lançamentos do centro passam a ter CR (ou ficam marcados sem destino, com o motivo).",
            "O fato do Sankhya não é editado: só a classificação do Eixo muda.",
          ]}
          render={(form) => (
            <>
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="mb-2">Centro {String(linha.codcencus ?? "")}</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="criar_cr"
                    className="size-4"
                    {...form.register("decisao")}
                  />
                  Criar o CR para este centro
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="sem_destino"
                    className="size-4"
                    {...form.register("decisao")}
                  />
                  Marcar sem destino
                </label>
                <p role="alert" className="text-destructive min-h-4 text-xs">
                  {form.formState.errors.decisao?.message}
                </p>
              </fieldset>
              <Campo rotulo="Código do CR (ao criar)" erro={form.formState.errors.codigo?.message}>
                {(p) => <input {...p} {...form.register("codigo")} className={CLASSE_DO_CAMPO} />}
              </Campo>
              <Campo rotulo="Nome do CR (opcional)" erro={form.formState.errors.nome?.message}>
                {(p) => <input {...p} {...form.register("nome")} className={CLASSE_DO_CAMPO} />}
              </Campo>
              <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
                {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
              </Campo>
            </>
          )}
          focoFinal={botao}
          {...comum}
        />
      ) : null}

      {aberto === "dono" ? (
        <AssistenteDeUmPasso<{ donoId: string; prazo: string }>
          id="atribuir-dono"
          titulo="Atribuir dono"
          passo="Dono e prazo"
          campos={["donoId", "prazo"]}
          registro={`${problema}-${referencia}`}
          valoresIniciais={{ donoId: linha.dono_id ?? "", prazo: linha.prazo?.slice(0, 10) ?? "" }}
          validar={(v) =>
            esquemaAtribuirDono.safeParse({
              problema,
              referencia,
              donoId: v.donoId,
              prazo: v.prazo === "" ? null : v.prazo,
            })
          }
          enviar={(v, chave) =>
            atribuirDonoAcao({
              chaveDeEnvio: chave,
              dados: {
                problema,
                referencia,
                donoId: v.donoId,
                prazo: v.prazo === "" ? null : v.prazo,
              },
            })
          }
          resumo={(v) => [
            { rotulo: "Dono", valor: pessoas.find((p) => p.id === v.donoId)?.nome ?? "" },
            { rotulo: "Prazo", valor: v.prazo ? formatarData(v.prazo) : "Sem prazo" },
          ]}
          efeitos={["O problema vira tarefa do dono, com o prazo; quem pega fica responsável."]}
          render={(form) => (
            <>
              <Campo rotulo="Dono" erro={form.formState.errors.donoId?.message}>
                {(p) => (
                  <select {...p} {...form.register("donoId")} className={CLASSE_DO_CAMPO}>
                    <option value="">Escolha…</option>
                    {pessoas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Prazo (opcional)" erro={form.formState.errors.prazo?.message}>
                {(p) => (
                  <input
                    {...p}
                    {...form.register("prazo")}
                    type="date"
                    className={CLASSE_DO_CAMPO}
                  />
                )}
              </Campo>
            </>
          )}
          focoFinal={botaoDoDono}
          {...comum}
        />
      ) : null}
    </div>
  );
}
