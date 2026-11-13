"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { Controller, type Resolver } from "react-hook-form";
import { z } from "zod";
import { CampoMoeda } from "@/components/formato/moeda";
import { Moeda } from "@/components/formato/moeda";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import {
  Campo,
  CampoComMais,
  CLASSE_DO_CAMPO,
  type OpcaoDeSelecao,
} from "@/components/wizard/campos";
import { useAssistenteNaUrl } from "@/components/wizard/use-assistente-na-url";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { erroDaAcao, sucesso } from "@/lib/wizard/resultado";

// O assistente de teste do Checkpoint 2 da Fase 2D: mostra o motor de interface sem tocar em dados
// reais (cadastrar um "item" de brinquedo). Os assistentes de verdade (placa) usam o mesmo motor.
// `?simular=falha|conflito|campo|lento` faz o "servidor" de mentira responder assim, para ver cada estado.

const esquema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, { error: "Informe o nome com pelo menos 3 letras." })
    .max(60, { error: "Use até 60 caracteres no nome." }),
  categoriaId: z.string().min(1, { error: "Escolha a categoria." }),
  quantidade: z
    .number({ error: "Informe a quantidade." })
    .int({ error: "Informe a quantidade em números inteiros." })
    .min(1, { error: "A quantidade mínima é 1." })
    .max(999, { error: "A quantidade máxima é 999." }),
  valorCentavos: z
    .number({ error: "Informe o valor." })
    .int()
    .min(1, { error: "Informe o valor maior que zero." }),
  observacao: z.string().max(200, { error: "Use até 200 caracteres na observação." }),
});
type Valores = z.infer<typeof esquema>;

const VALORES_INICIAIS: Valores = {
  nome: "",
  categoriaId: "",
  quantidade: 1,
  valorCentavos: 0,
  observacao: "",
};

const DEFINICAO: DefinicaoDeAssistente = {
  id: "teste",
  titulo: "Cadastrar item de teste",
  versaoDoEsquema: 1,
  passos: [
    { id: "identificacao", titulo: "Identificação", campos: ["nome", "categoriaId"] },
    { id: "valores", titulo: "Valores", campos: ["quantidade", "valorCentavos"] },
    { id: "observacao", titulo: "Observação", campos: ["observacao"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

/** O rascunho só confere os tipos (o que se digitou pela metade não pode ser descartado por regra de negócio). */
const esquemaDoRascunho = z
  .object({
    nome: z.string().max(200),
    categoriaId: z.string().max(100),
    quantidade: z.number(),
    valorCentavos: z.number().int(),
    observacao: z.string().max(500),
  })
  .partial();

const esquemaDaCategoria = z.object({
  nome: z
    .string()
    .trim()
    .min(3, { error: "Informe o nome da categoria com pelo menos 3 letras." })
    .max(40, { error: "Use até 40 caracteres no nome da categoria." }),
});
type ValoresDaCategoria = z.infer<typeof esquemaDaCategoria>;

const DEFINICAO_DA_CATEGORIA: DefinicaoDeAssistente = {
  id: "categoria-de-teste",
  titulo: "Cadastrar categoria",
  versaoDoEsquema: 1,
  passos: [
    { id: "dados", titulo: "Dados", campos: ["nome"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const CATEGORIAS_INICIAIS: OpcaoDeSelecao[] = [
  { id: "pneu", nome: "Pneu" },
  { id: "filtro", nome: "Filtro" },
];

const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const semAssinatura = () => () => {};

export interface RegistroDeEnvios {
  /** Cada chamada ao "servidor", com a chave de envio. */
  chamadas: string[];
  /** Quantos itens foram de fato gravados (a mesma chave grava uma vez só). */
  gravados: number;
}

export function AssistenteDeTeste() {
  const usuario = useUsuarioDaSessao();
  const { aberto, abrir, fechar } = useAssistenteNaUrl("teste");
  const parametros = useSearchParams();
  const simular = parametros.get("simular");
  // O assistente só monta no navegador, depois da hidratação (ele lê o rascunho do `localStorage`).
  const noNavegador = useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
  const [categorias, setCategorias] = useState<OpcaoDeSelecao[]>(CATEGORIAS_INICIAIS);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [envios, setEnvios] = useState<RegistroDeEnvios>({ chamadas: [], gravados: 0 });
  const porChave = useRef(new Map<string, string>());
  const jaSimulou = useRef(new Set<string>());
  const botao = useRef<HTMLButtonElement>(null);
  const nomeDaCategoria = (id: string) => categorias.find((c) => c.id === id)?.nome ?? "";

  async function gravar(valores: Valores, chave: string) {
    setEnvios((e) => ({ ...e, chamadas: [...e.chamadas, chave] }));
    await pausa(simular === "lento" ? 1500 : 400);
    const gravado = porChave.current.get(chave);
    if (gravado !== undefined) return sucesso({ nome: gravado }); // a mesma chave: a mesma linha
    // Cada falha simulada acontece uma vez só: "Tentar de novo" e "Revisar" depois funcionam.
    if (
      simular &&
      ["falha", "conflito", "campo"].includes(simular) &&
      !jaSimulou.current.has(simular)
    ) {
      jaSimulou.current.add(simular);
      if (simular === "falha") return erroDaAcao("falha");
      if (simular === "conflito")
        return erroDaAcao("conflito", { atual: { nome: "Pneu 295/80 (versão nova)" } });
      return erroDaAcao("entrada_invalida", {
        campos: { nome: ["Já existe um item com este nome. Use outro nome."] },
      });
    }
    porChave.current.set(chave, valores.nome);
    setEnvios((e) => ({ ...e, gravados: e.gravados + 1 }));
    return sucesso({ nome: valores.nome });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button ref={botao} onClick={abrir} data-testid="abrir-assistente-de-teste">
          <IconPlus data-icon="inline-start" />
          Cadastrar item de teste
        </Button>
        <p className="text-muted-foreground text-sm" data-testid="envios-do-assistente">
          Envios: {envios.chamadas.length} · Gravados: {envios.gravados}
          {ultimo ? ` · Último: ${ultimo}` : ""}
        </p>
      </div>
      {aberto && noNavegador ? (
        <Assistente<Valores>
          definicao={DEFINICAO}
          resolver={zodResolver(esquema) as unknown as Resolver<Valores>}
          valoresIniciais={VALORES_INICIAIS}
          validarRascunho={(v) => {
            const r = esquemaDoRascunho.safeParse(v);
            return r.success ? r.data : null;
          }}
          usuario={usuario}
          focoFinal={botao}
          rotuloConcluir="Cadastrar item"
          mensagemConcluido="Item cadastrado."
          aoConcluir={gravar}
          aoGravar={(linha) => setUltimo((linha as { nome: string }).nome)}
          descreverAtual={(atual) => (
            <p>
              Agora consta: <strong>{(atual as { nome: string }).nome}</strong>
            </p>
          )}
          aoFechar={fechar}
          resumo={(v) => [
            {
              titulo: "Identificação",
              linhas: [
                { rotulo: "Nome", valor: v.nome?.trim() },
                { rotulo: "Categoria", valor: nomeDaCategoria(v.categoriaId) },
              ],
            },
            {
              titulo: "Valores",
              linhas: [
                { rotulo: "Quantidade", valor: v.quantidade },
                {
                  rotulo: "Valor",
                  valor: v.valorCentavos > 0 ? <Moeda valor={v.valorCentavos} /> : "",
                },
              ],
            },
            { titulo: "Observação", linhas: [{ rotulo: "Texto", valor: v.observacao }] },
          ]}
          renderPasso={(passo, form) => {
            const erros = form.formState.errors;
            if (passo.id === "identificacao") {
              return (
                <>
                  <Campo rotulo="Nome" erro={erros.nome?.message}>
                    {(p) => (
                      <input
                        {...p}
                        {...form.register("nome")}
                        autoComplete="off"
                        className={CLASSE_DO_CAMPO}
                      />
                    )}
                  </Campo>
                  <Controller
                    control={form.control}
                    name="categoriaId"
                    render={({ field }) => (
                      <CampoComMais
                        rotulo="Categoria"
                        rotuloDoMais="Cadastrar categoria"
                        opcoes={categorias}
                        valor={field.value}
                        aoMudar={field.onChange}
                        erro={erros.categoriaId?.message}
                        semOpcao="Nenhuma categoria ainda. Use o + para cadastrar a primeira."
                        renderMini={({ aoCriar, aoFechar, focoFinal }) => (
                          <Assistente<ValoresDaCategoria>
                            definicao={DEFINICAO_DA_CATEGORIA}
                            resolver={
                              zodResolver(
                                esquemaDaCategoria,
                              ) as unknown as Resolver<ValoresDaCategoria>
                            }
                            valoresIniciais={{ nome: "" }}
                            validarRascunho={() => null}
                            usuario={usuario}
                            variante="empilhado"
                            rascunho={false}
                            fecharAoGravar
                            focoFinal={focoFinal}
                            rotuloConcluir="Cadastrar categoria"
                            mensagemConcluido="Categoria cadastrada."
                            aoConcluir={async (v) => {
                              await pausa(200);
                              const nome = v.nome.trim();
                              return sucesso({
                                id: `cat-${nome.toLowerCase().replaceAll(/\s+/g, "-")}`,
                                nome,
                              });
                            }}
                            aoGravar={(linha) => {
                              const nova = linha as OpcaoDeSelecao;
                              setCategorias((atuais) =>
                                atuais.some((c) => c.id === nova.id) ? atuais : [...atuais, nova],
                              );
                              aoCriar(nova);
                            }}
                            aoFechar={aoFechar}
                            resumo={(v) => [
                              {
                                titulo: "Categoria",
                                linhas: [{ rotulo: "Nome", valor: v.nome?.trim() }],
                              },
                            ]}
                            renderPasso={(_, formDaCategoria) => (
                              <Campo
                                rotulo="Nome da categoria"
                                erro={formDaCategoria.formState.errors.nome?.message}
                              >
                                {(p) => (
                                  <input
                                    {...p}
                                    {...formDaCategoria.register("nome")}
                                    autoComplete="off"
                                    className={CLASSE_DO_CAMPO}
                                  />
                                )}
                              </Campo>
                            )}
                          />
                        )}
                      />
                    )}
                  />
                </>
              );
            }
            if (passo.id === "valores") {
              return (
                <>
                  <Campo rotulo="Quantidade" erro={erros.quantidade?.message}>
                    {(p) => (
                      <input
                        {...p}
                        {...form.register("quantidade", { valueAsNumber: true })}
                        type="number"
                        inputMode="numeric"
                        className={CLASSE_DO_CAMPO}
                      />
                    )}
                  </Campo>
                  <Controller
                    control={form.control}
                    name="valorCentavos"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1">
                        <CampoMoeda rotulo="Valor" valor={field.value} onChange={field.onChange} />
                        {erros.valorCentavos?.message ? (
                          <p role="alert" className="text-destructive text-xs">
                            {erros.valorCentavos.message}
                          </p>
                        ) : null}
                      </div>
                    )}
                  />
                </>
              );
            }
            return (
              <Campo rotulo="Observação (opcional)" erro={erros.observacao?.message}>
                {(p) => (
                  <textarea
                    {...p}
                    {...form.register("observacao")}
                    rows={4}
                    className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
                  />
                )}
              </Campo>
            );
          }}
        />
      ) : null}
    </div>
  );
}
