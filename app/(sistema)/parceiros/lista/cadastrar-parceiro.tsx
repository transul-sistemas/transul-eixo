"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { ProvedorDoUsuario, useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import type { ParceirosDoMes } from "@/lib/dados/parceiros-tipos";
import { tipoDoDocumento } from "@/lib/dominio/cpf-cnpj";
import {
  esquemaCadastrarParceiro,
  NOMES_DOS_TIPOS_DE_PARCEIRO,
  TIPOS_DE_PARCEIRO,
  type TipoDeParceiro,
} from "@/lib/dominio/esquemas/parceiros";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cadastrarParceiroAcao } from "../acoes";

// O assistente "Cadastrar parceiro" (o principal da lista): o CPF ou CNPJ (validado aqui e no banco,
// sem duplicata), o nome, os tipos e, do Sankhya, o CODPARC e o agrupador (o CR pai dos CRs de
// acionista das placas do parceiro). O mesmo documento de uma pessoa que já existe reaproveita a pessoa.

interface Valores {
  documento: string;
  nome: string;
  tipos: TipoDeParceiro[];
  codparc: string;
  agrupadorId: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "parceiro-cadastrar",
  titulo: "Cadastrar parceiro",
  versaoDoEsquema: 1,
  passos: [
    { id: "parceiro", titulo: "Parceiro", campos: ["documento", "nome", "tipos"] },
    { id: "sankhya", titulo: "Sankhya", campos: ["codparc", "agrupadorId"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

type Agrupadores = ParceirosDoMes["agrupadoresLivres"];

const nomeDoAgrupador = (a: Agrupadores[number]) =>
  `${a.codigo}${a.nome ? ` ${a.nome}` : ""} (${a.crs} ${a.crs === 1 ? "CR" : "CRs"})`;

function AssistenteCadastrarParceiro({
  agrupadores,
  aoFechar,
  focoFinal,
}: {
  agrupadores: Agrupadores;
  aoFechar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const router = useRouter();
  const entrada = (v: Valores) => ({ ...v, tipos: v.tipos ?? [] });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaCadastrarParceiro.safeParse(entrada(valores));
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  const agrupadorDe = (id: string) => agrupadores.find((a) => a.id === id);

  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ documento: "", nome: "", tipos: [], codparc: "", agrupadorId: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro="novo"
      // Sem rascunho: o CPF ou CNPJ não fica guardado no navegador.
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Cadastrar parceiro"
      mensagemConcluido="Parceiro cadastrado."
      fecharAoGravar
      aoGravar={() => router.refresh()}
      aoConcluir={(valores, chaveDeEnvio) =>
        cadastrarParceiroAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Parceiro",
          linhas: [
            {
              rotulo: tipoDoDocumento(v.documento ?? "") === "cnpj" ? "CNPJ" : "CPF",
              valor: v.documento?.trim() || undefined,
            },
            { rotulo: "Nome", valor: v.nome?.trim() || undefined },
            {
              rotulo: "Tipo",
              valor:
                (v.tipos ?? []).map((t) => NOMES_DOS_TIPOS_DE_PARCEIRO[t]).join(", ") || undefined,
            },
          ],
        },
        {
          titulo: "Sankhya",
          linhas: [
            { rotulo: "CODPARC", valor: v.codparc?.trim() || "—" },
            {
              rotulo: "Agrupador",
              valor: v.agrupadorId ? (agrupadorDe(v.agrupadorId)?.codigo ?? "—") : "—",
            },
          ],
        },
      ]}
      efeitos={(v) => [
        "Se o CPF ou CNPJ já for de uma pessoa do Eixo, a pessoa é a mesma e o nome dela continua.",
        v.agrupadorId
          ? "As placas dos CRs de acionista do agrupador passam a ser do parceiro, na lista e na conciliação."
          : "Sem agrupador, o parceiro aparece na lista e pode ter locações, mas não entra na conciliação.",
      ]}
      renderPasso={(passo, form) => {
        const erros = form.formState.errors;
        if (passo.id === "parceiro") {
          return (
            <GradeDeCampos>
              <Campo
                rotulo="CPF ou CNPJ"
                erro={erros.documento?.message}
                ajuda="Só os números, ou com pontos e traço."
              >
                {(p) => (
                  <input
                    {...p}
                    {...form.register("documento")}
                    inputMode="numeric"
                    autoComplete="off"
                    className={CLASSE_DO_CAMPO}
                  />
                )}
              </Campo>
              <Campo rotulo="Nome ou razão social" erro={erros.nome?.message}>
                {(p) => (
                  <input
                    {...p}
                    {...form.register("nome")}
                    autoComplete="off"
                    className={CLASSE_DO_CAMPO}
                  />
                )}
              </Campo>
              <fieldset className="flex flex-col gap-2 text-sm sm:col-span-2">
                <legend className="text-muted-foreground mb-1">Tipo</legend>
                <div className="flex flex-wrap gap-4">
                  {TIPOS_DE_PARCEIRO.map((t) => (
                    <label key={t} className="flex min-h-9 items-center gap-2">
                      <input
                        type="checkbox"
                        value={t}
                        className="size-4"
                        {...form.register("tipos")}
                      />
                      {NOMES_DOS_TIPOS_DE_PARCEIRO[t]}
                    </label>
                  ))}
                </div>
                <p role="alert" className="text-destructive min-h-4 text-xs">
                  {erros.tipos?.message}
                </p>
              </fieldset>
            </GradeDeCampos>
          );
        }
        return (
          <GradeDeCampos>
            <Campo
              rotulo="CODPARC (opcional)"
              erro={erros.codparc?.message}
              ajuda="O código do parceiro no Sankhya."
            >
              {(p) => (
                <input
                  {...p}
                  {...form.register("codparc")}
                  inputMode="numeric"
                  autoComplete="off"
                  className={CLASSE_DO_CAMPO}
                />
              )}
            </Campo>
            <Campo
              rotulo="Agrupador no Sankhya (opcional)"
              erro={erros.agrupadorId?.message}
              ajuda="O CR pai dos CRs de acionista das placas do parceiro."
            >
              {(p) => (
                <select {...p} {...form.register("agrupadorId")} className={CLASSE_DO_CAMPO}>
                  <option value="">Sem agrupador</option>
                  {agrupadores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {nomeDoAgrupador(a)}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </GradeDeCampos>
        );
      }}
    />
  );
}

/** O botão "Cadastrar parceiro" e o assistente que ele abre (com o usuário da sessão acima). */
export function CadastrarParceiro({
  agrupadores,
  usuario,
}: {
  agrupadores: Agrupadores;
  /** Quem usa: a chave dos rascunhos. */
  usuario: string;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  return (
    <ProvedorDoUsuario usuario={usuario}>
      <Button ref={botao} onClick={() => setAberto(true)} aria-haspopup="dialog">
        Cadastrar parceiro
      </Button>
      {aberto ? (
        <AssistenteCadastrarParceiro
          agrupadores={agrupadores}
          aoFechar={() => setAberto(false)}
          focoFinal={botao}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
