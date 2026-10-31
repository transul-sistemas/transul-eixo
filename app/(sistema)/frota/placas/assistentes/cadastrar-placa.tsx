"use client";

import Link from "next/link";
import { type RefObject, useMemo } from "react";
import { Controller, type Resolver, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { CampoMoeda, Moeda } from "@/components/formato/moeda";
import { Assistente } from "@/components/wizard/assistente";
import {
  Campo,
  CampoComMais,
  CLASSE_DO_CAMPO,
  GradeDeCampos,
  type OpcaoDeSelecao,
} from "@/components/wizard/campos";
import type { DadosDosAssistentes } from "@/lib/dados/escrita-tipos";
import { paraEntradaDoCadastro } from "@/lib/dados/entradas-dos-assistentes";
import type { Catalogos, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import {
  esquemaCadastrarPlaca,
  siglasIniciaisDoTipo,
  TIPOS_DE_ATIVO,
} from "@/lib/dominio/esquemas/placa";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import { USUARIO_PROVISORIO } from "@/lib/navegacao/perfis";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cadastrarPlacaAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { ACAO_DO_MAIS, renderizarMini } from "./mini-cadastro-de-catalogo";

// Cadastrar placa: seis passos. O mesmo esquema Zod do servidor valida aqui; o "+" cria, na hora,
// o que falta (marca, modelo, gestor, operação, CR, filial e garagem).

export interface ValoresDoCadastro {
  placa: string;
  renavam: string;
  tipo: string;
  marcaId: string;
  modeloId: string;
  /** Texto do campo; vira número só na conferência. */
  ano: string;
  codigoFipe: string;
  valorFipeCentavos: number;
  valorManualCentavos: number;
  fonteDoValor: string;
  dataDoValor: string;
  gestorId: string;
  operacaoId: string;
  crId: string;
  filialId: string;
  garagemId: string;
  situacaoInicial: string;
}

const VALORES_INICIAIS: ValoresDoCadastro = {
  placa: "",
  renavam: "",
  tipo: "",
  marcaId: "",
  modeloId: "",
  ano: "",
  codigoFipe: "",
  valorFipeCentavos: 0,
  valorManualCentavos: 0,
  fonteDoValor: "",
  dataDoValor: "",
  gestorId: "",
  operacaoId: "",
  crId: "",
  filialId: "",
  garagemId: "",
  situacaoInicial: "PÁT",
};

export const DEFINICAO_DO_CADASTRO: DefinicaoDeAssistente = {
  id: "cadastrar-placa",
  titulo: "Cadastrar placa",
  versaoDoEsquema: 2,
  passos: [
    {
      id: "identificacao",
      titulo: "Identificação",
      campos: ["placa", "renavam", "tipo", "ano"],
    },
    { id: "veiculo", titulo: "Veículo", campos: ["marcaId", "modeloId"] },
    {
      id: "valor",
      titulo: "Valor",
      campos: [
        "codigoFipe",
        "valorFipeCentavos",
        "valorManualCentavos",
        "fonteDoValor",
        "dataDoValor",
      ],
    },
    { id: "posse", titulo: "Posse", campos: ["gestorId", "operacaoId", "crId"] },
    {
      id: "local",
      titulo: "Local e situação",
      campos: ["filialId", "garagemId", "situacaoInicial"],
    },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

/** O rascunho só confere os tipos (o que se digita pela metade não pode ser barrado por regra de negócio). */
const esquemaDoRascunho = z
  .object({
    placa: z.string().max(20),
    tipo: z.string().max(20),
    marcaId: z.string().max(100),
    modeloId: z.string().max(100),
    ano: z.string().max(10),
    codigoFipe: z.string().max(20),
    valorFipeCentavos: z.number().int(),
    valorManualCentavos: z.number().int(),
    fonteDoValor: z.string().max(200),
    dataDoValor: z.string().max(10),
    gestorId: z.string().max(100),
    operacaoId: z.string().max(100),
    crId: z.string().max(100),
    filialId: z.string().max(100),
    garagemId: z.string().max(100),
    situacaoInicial: z.string().max(10),
  })
  .partial();

const ehTipoFipe = (tipo: string) => tipo === "cavalo" || tipo === "caminhao";

function criarResolver(anoAtual: number, hoje: string): Resolver<ValoresDoCadastro> {
  const esquema = esquemaCadastrarPlaca({ anoAtual, hoje });
  return async (valores) => {
    // Sem o tipo, a união do Zod só acusaria o tipo; confere o resto como um tipo qualquer.
    const entrada = paraEntradaDoCadastro({
      ...valores,
      ano: valores.ano === "" ? undefined : Number(valores.ano),
      tipo: valores.tipo === "" ? "apoio" : valores.tipo,
    });
    const resultado = esquema.safeParse(entrada);
    // Sem o tipo escolhido, o valor que só vale para um tipo ainda não é problema.
    const problemas = resultado.success
      ? []
      : resultado.error.issues
          .map((i) => ({ path: i.path, message: i.message }))
          .filter(
            (i) =>
              valores.tipo !== "" ||
              !/^(valorManual|fonteDoValor|dataDoValor)/.test(String(i.path[0])),
          );
    if (valores.tipo === "")
      problemas.push({ path: ["tipo"], message: "Escolha o tipo de ativo." });
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<ValoresDoCadastro>(problemas) };
  };
}

export function CadastrarPlaca({
  dados,
  catalogos,
  aoItemCriado,
  aoFechar,
  focoFinal,
}: {
  dados: DadosDosAssistentes;
  /** O catálogo do servidor mais o que o "+" já criou nesta tela. */
  catalogos: Catalogos;
  aoItemCriado: (item: ItemCriado) => void;
  aoFechar: () => void;
  focoFinal: RefObject<HTMLElement | null>;
}) {
  const resolver = useMemo(
    () => criarResolver(dados.anoAtual, dados.hoje),
    [dados.anoAtual, dados.hoje],
  );
  const nome = (lista: readonly OpcaoDeSelecao[], id: string) =>
    lista.find((o) => o.id === id)?.nome ?? "";
  const modeloNome = (id: string) => catalogos.modelos.find((m) => m.id === id)?.nome ?? "";
  const crCodigo = (id: string) => catalogos.crs.find((c) => c.id === id)?.codigo ?? "";

  return (
    <Assistente<ValoresDoCadastro>
      definicao={DEFINICAO_DO_CADASTRO}
      resolver={resolver}
      valoresIniciais={VALORES_INICIAIS}
      validarRascunho={(v) => {
        const r = esquemaDoRascunho.safeParse(v);
        return r.success ? (r.data as Partial<ValoresDoCadastro>) : null;
      }}
      usuario={USUARIO_PROVISORIO}
      camposSensiveis={["renavam"]}
      focoFinal={focoFinal}
      rotuloConcluir="Cadastrar placa"
      mensagemConcluido="Placa cadastrada."
      aoConcluir={(valores, chaveDeEnvio) =>
        cadastrarPlacaAcao({
          chaveDeEnvio,
          dados: paraEntradaDoCadastro({
            ...valores,
            ano: valores.ano === "" ? undefined : Number(valores.ano),
          }),
        })
      }
      descreverAtual={(atual) => {
        const placa = atual as PlacaGravada;
        return <p>Agora consta: {placa.placa}.</p>;
      }}
      descreverErro={(erro) => {
        const existente = (erro.atual as PlacaGravada | undefined)?.placa;
        return erro.codigo === "placa_ja_existe" && existente ? (
          <Link
            href={`/frota/placas/${existente}`}
            className="text-foreground underline underline-offset-4"
          >
            Abrir a ficha de {existente}
          </Link>
        ) : null;
      }}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Identificação",
          linhas: [
            { rotulo: "Placa", valor: v.placa?.trim().toUpperCase() },
            {
              rotulo: "Tipo",
              valor: NOMES_DOS_TIPOS[v.tipo as keyof typeof NOMES_DOS_TIPOS] ?? "",
            },
          ],
        },
        {
          titulo: "Veículo",
          linhas: [
            { rotulo: "Marca", valor: nome(catalogos.marcas, v.marcaId) },
            { rotulo: "Modelo", valor: modeloNome(v.modeloId) },
            { rotulo: "Ano", valor: v.ano },
          ],
        },
        {
          titulo: "Valor",
          linhas: ehTipoFipe(v.tipo)
            ? [
                { rotulo: "Código FIPE", valor: v.codigoFipe },
                {
                  rotulo: "Valor FIPE",
                  valor: v.valorFipeCentavos > 0 ? <Moeda valor={v.valorFipeCentavos} /> : "",
                },
              ]
            : [
                {
                  rotulo: "Valor",
                  valor: v.valorManualCentavos > 0 ? <Moeda valor={v.valorManualCentavos} /> : "",
                },
                { rotulo: "Fonte do valor", valor: v.fonteDoValor },
                { rotulo: "Data do valor", valor: v.dataDoValor },
              ],
        },
        {
          titulo: "Posse",
          linhas: [
            { rotulo: "Gestor de frota", valor: nome(catalogos.gestores, v.gestorId) },
            { rotulo: "Operação", valor: nome(catalogos.operacoes, v.operacaoId) },
            { rotulo: "CR", valor: crCodigo(v.crId) },
          ],
        },
        {
          titulo: "Local e situação",
          linhas: [
            { rotulo: "Filial", valor: nome(catalogos.filiais, v.filialId) },
            { rotulo: "Garagem", valor: nome(catalogos.garagens, v.garagemId) },
            {
              rotulo: "Situação inicial",
              valor: v.situacaoInicial
                ? `${v.situacaoInicial} · ${NOMES_DAS_SIGLAS[v.situacaoInicial as Sigla] ?? ""}`
                : "",
            },
          ],
        },
      ]}
      efeitos={(v) => {
        const gestor = nome(catalogos.gestores, v.gestorId);
        const operacao = nome(catalogos.operacoes, v.operacaoId);
        const cr = crCodigo(v.crId);
        const sigla = (v.situacaoInicial || "PÁT") as Sigla;
        return [
          <>
            A placa entra na frota com a situação{" "}
            <b>
              {sigla} · {NOMES_DAS_SIGLAS[sigla]}
            </b>
            {gestor ? (
              <>
                {" "}
                e fica na carteira de <b>{gestor}</b>
              </>
            ) : null}
            .
          </>,
          operacao ? (
            <>
              Os custos passam a cair no CR <b>{cr || "a escolher"}</b>, na <b>{operacao}</b>.
            </>
          ) : (
            "A placa fica sem operação e sem CR por enquanto."
          ),
          <>
            Um evento é registrado na linha do tempo da placa, em{" "}
            <b>{formatarDataEHora(agoraEmSaoPaulo(new Date()))}</b>.
          </>,
          "Nenhum conjunto é montado agora. Engatar é uma ação à parte.",
        ];
      }}
      renderPasso={(passo, form) => (
        <PassoDoCadastro
          passo={passo.id}
          form={form}
          catalogos={catalogos}
          aoItemCriado={aoItemCriado}
        />
      )}
    />
  );
}

function PassoDoCadastro({
  passo,
  form,
  catalogos,
  aoItemCriado,
}: {
  passo: string;
  form: UseFormReturn<ValoresDoCadastro>;
  catalogos: Catalogos;
  aoItemCriado: (item: ItemCriado) => void;
}) {
  const erros = form.formState.errors;
  const tipo = form.watch("tipo");
  const marcaId = form.watch("marcaId");
  const operacaoId = form.watch("operacaoId");
  const filialId = form.watch("filialId");
  if (passo === "identificacao") {
    return (
      <>
        <GradeDeCampos>
          <Campo rotulo="Placa" erro={erros.placa?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("placa")}
                autoComplete="off"
                autoCapitalize="characters"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
          <Campo rotulo="RENAVAM" erro={erros.renavam?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("renavam")}
                autoComplete="off"
                inputMode="numeric"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        </GradeDeCampos>
        <GradeDeCampos>
          <Campo rotulo="Tipo de ativo" erro={erros.tipo?.message}>
            {(p) => (
              <select {...p} {...form.register("tipo")} className={CLASSE_DO_CAMPO}>
                <option value="">Escolha…</option>
                {TIPOS_DE_ATIVO.map((t) => (
                  <option key={t} value={t}>
                    {NOMES_DOS_TIPOS[t]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Ano" erro={erros.ano?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("ano")}
                inputMode="numeric"
                autoComplete="off"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        </GradeDeCampos>
      </>
    );
  }

  if (passo === "veiculo") {
    const modelos = catalogos.modelos.filter((m) => m.marcaId === marcaId);
    return (
      <GradeDeCampos>
        <Controller
          control={form.control}
          name="marcaId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Marca"
              rotuloDoMais={ACAO_DO_MAIS("marca")}
              opcoes={catalogos.marcas}
              valor={field.value}
              aoMudar={(id) => {
                if (id !== field.value) form.setValue("modeloId", "");
                field.onChange(id);
              }}
              erro={erros.marcaId?.message}
              semOpcao="Nenhuma marca ainda. Use o + para cadastrar a primeira."
              renderMini={(m) => renderizarMini(m, "marca", undefined, aoItemCriado)}
            />
          )}
        />
        <Controller
          control={form.control}
          name="modeloId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Modelo"
              rotuloDoMais={ACAO_DO_MAIS("modelo")}
              opcoes={modelos}
              valor={field.value}
              aoMudar={field.onChange}
              erro={erros.modeloId?.message}
              desligadoPorque={marcaId ? undefined : "Escolha a marca primeiro."}
              semOpcao="Esta marca ainda não tem modelo. Use o + para cadastrar."
              renderMini={(m) => renderizarMini(m, "modelo", marcaId, aoItemCriado)}
            />
          )}
        />
      </GradeDeCampos>
    );
  }

  if (passo === "valor") {
    return ehTipoFipe(tipo) ? (
      <GradeDeCampos>
        <Campo rotulo="Código FIPE" erro={erros.codigoFipe?.message} ajuda="No formato 000000-0.">
          {(p) => (
            <input
              {...p}
              {...form.register("codigoFipe")}
              autoComplete="off"
              className={CLASSE_DO_CAMPO}
            />
          )}
        </Campo>
        <CampoDeValor form={form} nome="valorFipeCentavos" rotulo="Valor FIPE" />
      </GradeDeCampos>
    ) : (
      <>
        <GradeDeCampos>
          <CampoDeValor form={form} nome="valorManualCentavos" rotulo="Valor" />
          <Campo rotulo="Data do valor" erro={erros.dataDoValor?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("dataDoValor")}
                type="date"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        </GradeDeCampos>
        <Campo rotulo="Fonte do valor" erro={erros.fonteDoValor?.message}>
          {(p) => (
            <input
              {...p}
              {...form.register("fonteDoValor")}
              autoComplete="off"
              className={CLASSE_DO_CAMPO}
            />
          )}
        </Campo>
      </>
    );
  }

  if (passo === "posse") {
    const crs = catalogos.crs
      .filter((c) => c.operacaoId === operacaoId)
      .map((c) => ({ id: c.id, nome: c.codigo }));
    return (
      <>
        <Controller
          control={form.control}
          name="gestorId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Gestor de frota"
              rotuloDoMais={ACAO_DO_MAIS("gestor")}
              opcoes={catalogos.gestores}
              valor={field.value}
              aoMudar={field.onChange}
              erro={erros.gestorId?.message}
              semOpcao="Nenhum gestor ainda. Use o + para cadastrar o primeiro."
              renderMini={(m) => renderizarMini(m, "gestor", undefined, aoItemCriado)}
            />
          )}
        />
        <GradeDeCampos>
          <Controller
            control={form.control}
            name="operacaoId"
            render={({ field }) => (
              <CampoComMais
                rotulo="Operação"
                rotuloDoMais={ACAO_DO_MAIS("operacao")}
                opcoes={catalogos.operacoes}
                valor={field.value}
                aoMudar={(id) => {
                  if (id !== field.value) form.setValue("crId", "");
                  field.onChange(id);
                }}
                erro={erros.operacaoId?.message}
                renderMini={(m) => renderizarMini(m, "operacao", undefined, aoItemCriado)}
              />
            )}
          />
          <Controller
            control={form.control}
            name="crId"
            render={({ field }) => (
              <CampoComMais
                rotulo="CR"
                rotuloDoMais={ACAO_DO_MAIS("cr")}
                opcoes={crs}
                valor={field.value}
                aoMudar={field.onChange}
                erro={erros.crId?.message}
                desligadoPorque={operacaoId ? undefined : "Escolha a operação primeiro."}
                semOpcao="Esta operação ainda não tem CR. Use o + para cadastrar."
                renderMini={(m) => renderizarMini(m, "cr", operacaoId, aoItemCriado)}
              />
            )}
          />
        </GradeDeCampos>
      </>
    );
  }

  // local
  const garagens = catalogos.garagens.filter((g) => g.filialId === filialId);
  const situacoes = siglasIniciaisDoTipo((tipo || "apoio") as never);
  return (
    <>
      <GradeDeCampos>
        <Controller
          control={form.control}
          name="filialId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Filial"
              rotuloDoMais={ACAO_DO_MAIS("filial")}
              opcoes={catalogos.filiais}
              valor={field.value}
              aoMudar={(id) => {
                if (id !== field.value) form.setValue("garagemId", "");
                field.onChange(id);
              }}
              erro={erros.filialId?.message}
              semOpcao="Nenhuma filial ainda. Use o + para cadastrar a primeira."
              renderMini={(m) => renderizarMini(m, "filial", undefined, aoItemCriado)}
            />
          )}
        />
        <Controller
          control={form.control}
          name="garagemId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Garagem"
              rotuloDoMais={ACAO_DO_MAIS("garagem")}
              opcoes={garagens}
              valor={field.value}
              aoMudar={field.onChange}
              erro={erros.garagemId?.message}
              desligadoPorque={filialId ? undefined : "Escolha a filial primeiro."}
              semOpcao="Esta filial ainda não tem garagem. Use o + para cadastrar."
              renderMini={(m) => renderizarMini(m, "garagem", filialId, aoItemCriado)}
            />
          )}
        />
      </GradeDeCampos>
      <Campo rotulo="Situação inicial" erro={erros.situacaoInicial?.message}>
        {(p) => (
          <select {...p} {...form.register("situacaoInicial")} className={CLASSE_DO_CAMPO}>
            {situacoes.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla} · {NOMES_DAS_SIGLAS[sigla]}
              </option>
            ))}
          </select>
        )}
      </Campo>
    </>
  );
}

function CampoDeValor({
  form,
  nome,
  rotulo,
}: {
  form: UseFormReturn<ValoresDoCadastro>;
  nome: "valorFipeCentavos" | "valorManualCentavos";
  rotulo: string;
}) {
  const erro = form.formState.errors[nome]?.message;
  return (
    <Controller
      control={form.control}
      name={nome}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <CampoMoeda rotulo={rotulo} valor={field.value} onChange={field.onChange} />
          <p role="alert" className="text-destructive min-h-4 text-xs">
            {erro}
          </p>
        </div>
      )}
    />
  );
}
