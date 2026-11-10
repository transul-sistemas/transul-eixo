"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { formatarData } from "@/components/formato/data";
import { CampoMoeda } from "@/components/formato/moeda";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import type { Locacao, Locacoes } from "@/lib/dados/parceiros-tipos";
import { normalizarPlaca } from "@/lib/dominio/placa";
import { esquemaCadastrarLocacao, esquemaEncerrarLocacao } from "@/lib/dominio/esquemas/parceiros";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cadastrarLocacaoAcao, encerrarLocacaoAcao } from "../acoes";

// Os assistentes da Locação: "Cadastrar locação" (parceiro, placa, vigência e valor mensal; o banco
// recusa a mesma placa com duas locações ao mesmo tempo) e "Encerrar locação" (o dia em que a placa
// deixa de estar locada e o motivo, com a versão que a pessoa viu).

function resolvedor<V extends object>(
  validar: (v: V) => {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  },
  campos: readonly string[],
): Resolver<V> {
  return async (valores) => {
    const r = validar(valores as V);
    const problemas = r.success
      ? []
      : r.error!.issues.filter((i) => campos.includes(String(i.path[0])));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<V>(
            problemas.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
}

interface ValoresDoCadastro {
  parceiroId: string;
  placa: string;
  inicio: string;
  fim: string;
  valorMensalCentavos: number;
}

const DEFINICAO_DO_CADASTRO: DefinicaoDeAssistente = {
  id: "locacao-cadastrar",
  titulo: "Cadastrar locação",
  versaoDoEsquema: 1,
  passos: [
    { id: "contrato", titulo: "Contrato", campos: ["parceiroId", "placa"] },
    {
      id: "vigencia",
      titulo: "Vigência e valor",
      campos: ["inicio", "fim", "valorMensalCentavos"],
    },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const CAMPOS_DO_CADASTRO = ["parceiroId", "placa", "inicio", "fim", "valorMensalCentavos"];

export function CadastrarLocacao({
  parceiros,
  hoje,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  parceiros: Locacoes["parceiros"];
  hoje: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const nomeDe = (id: string) => parceiros.find((p) => p.id === id)?.nome;
  return (
    <Assistente<ValoresDoCadastro>
      definicao={DEFINICAO_DO_CADASTRO}
      resolver={resolvedor<ValoresDoCadastro>(
        (v) => esquemaCadastrarLocacao.safeParse(v),
        CAMPOS_DO_CADASTRO,
      )}
      valoresIniciais={{ parceiroId: "", placa: "", inicio: hoje, fim: "", valorMensalCentavos: 0 }}
      validarRascunho={() => null}
      usuario={usuario}
      registro="nova"
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Cadastrar locação"
      mensagemConcluido="Locação cadastrada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) => cadastrarLocacaoAcao({ chaveDeEnvio, dados: valores })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Locação",
          linhas: [
            { rotulo: "Parceiro", valor: v.parceiroId ? nomeDe(v.parceiroId) : undefined },
            { rotulo: "Placa", valor: v.placa ? normalizarPlaca(v.placa) : undefined },
            { rotulo: "Início", valor: v.inicio ? formatarData(v.inicio) : undefined },
            { rotulo: "Fim", valor: v.fim ? formatarData(v.fim) : "sem fim combinado" },
            {
              rotulo: "Valor mensal",
              valor: v.valorMensalCentavos ? formatarMoeda(v.valorMensalCentavos) : undefined,
            },
          ],
        },
      ]}
      efeitos={() => [
        "A placa conta como locada do parceiro a partir do início, na lista e na ficha dele.",
        "A mesma placa não tem duas locações ao mesmo tempo: o banco recusa a sobreposição.",
      ]}
      renderPasso={(passo, form) => {
        const erros = form.formState.errors;
        if (passo.id === "contrato") {
          return (
            <GradeDeCampos>
              <Campo rotulo="Parceiro (locador)" erro={erros.parceiroId?.message}>
                {(p) => (
                  <select {...p} {...form.register("parceiroId")} className={CLASSE_DO_CAMPO}>
                    <option value="">Escolha o parceiro</option>
                    {parceiros.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo
                rotulo="Placa"
                erro={erros.placa?.message}
                ajuda="A placa vigente na frota, como ABC1D23."
              >
                {(p) => (
                  <input
                    {...p}
                    {...form.register("placa")}
                    autoComplete="off"
                    maxLength={8}
                    className={`${CLASSE_DO_CAMPO} uppercase`}
                  />
                )}
              </Campo>
            </GradeDeCampos>
          );
        }
        return (
          <GradeDeCampos>
            <Campo rotulo="Início" erro={erros.inicio?.message}>
              {(p) => (
                <input
                  {...p}
                  type="date"
                  {...form.register("inicio")}
                  className={CLASSE_DO_CAMPO}
                />
              )}
            </Campo>
            <Campo
              rotulo="Fim (opcional)"
              erro={erros.fim?.message}
              ajuda="O dia em que a placa deixa de estar locada."
            >
              {(p) => (
                <input {...p} type="date" {...form.register("fim")} className={CLASSE_DO_CAMPO} />
              )}
            </Campo>
            <div className="flex flex-col gap-1">
              <CampoMoeda
                rotulo="Valor mensal"
                valor={form.watch("valorMensalCentavos") ?? 0}
                onChange={(centavos) =>
                  form.setValue("valorMensalCentavos", centavos, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {erros.valorMensalCentavos?.message}
              </p>
            </div>
          </GradeDeCampos>
        );
      }}
    />
  );
}

interface ValoresDoEncerramento {
  fim: string;
  motivo: string;
}

const DEFINICAO_DO_ENCERRAMENTO: DefinicaoDeAssistente = {
  id: "locacao-encerrar",
  titulo: "Encerrar locação",
  versaoDoEsquema: 1,
  passos: [
    { id: "encerramento", titulo: "Encerramento", campos: ["fim", "motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function EncerrarLocacao({
  locacao,
  hoje,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  locacao: Locacao;
  hoje: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: ValoresDoEncerramento) => ({
    locacaoId: locacao.id,
    versao: locacao.versao,
    inicio: locacao.inicio,
    fim: v.fim ?? "",
    motivo: v.motivo ?? "",
  });
  return (
    <Assistente<ValoresDoEncerramento>
      definicao={DEFINICAO_DO_ENCERRAMENTO}
      resolver={resolvedor<ValoresDoEncerramento>(
        (v) => esquemaEncerrarLocacao.safeParse(entrada(v)),
        ["fim", "motivo"],
      )}
      valoresIniciais={{ fim: locacao.fim ?? (hoje > locacao.inicio ? hoje : ""), motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={locacao.id}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Encerrar locação"
      mensagemConcluido="Locação encerrada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        encerrarLocacaoAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>Esta locação mudou desde que você abriu a lista. Feche o assistente e abra de novo.</p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Locação",
          linhas: [
            { rotulo: "Parceiro", valor: locacao.parceiroNome },
            { rotulo: "Placa", valor: locacao.placa },
            { rotulo: "Início", valor: formatarData(locacao.inicio) },
            { rotulo: "Encerra em", valor: v.fim ? formatarData(v.fim) : undefined },
            { rotulo: "Motivo", valor: v.motivo?.trim() || undefined },
          ],
        },
      ]}
      efeitos={() => [
        "A partir do dia do encerramento a placa deixa de estar locada do parceiro.",
        "Uma nova locação da mesma placa pode começar nesse mesmo dia.",
      ]}
      renderPasso={(_, form) => (
        <GradeDeCampos>
          <Campo
            rotulo="Encerra em"
            erro={form.formState.errors.fim?.message}
            ajuda="O primeiro dia sem a locação."
          >
            {(p) => (
              <input {...p} type="date" {...form.register("fim")} className={CLASSE_DO_CAMPO} />
            )}
          </Campo>
          <Campo rotulo="Motivo do encerramento" erro={form.formState.errors.motivo?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("motivo")}
                autoComplete="off"
                maxLength={500}
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        </GradeDeCampos>
      )}
    />
  );
}
