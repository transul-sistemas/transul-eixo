import { z } from "zod";
import { TIPOS_DE_ATIVO, type TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { conjuntoMisto } from "../conjunto";
import { normalizarPlaca, placaNormalizadaValida } from "../placa";
import { motivoDeNaoDisponibilizar } from "../custodia";
import { SIGLAS, siglaAceitaOTipo, type Sigla } from "../status";

// Esquemas Zod dos assistentes de placa: o MESMO arquivo valida na tela (React Hook Form) e no
// servidor (Server Action). Dinheiro sempre em centavos inteiros (no banco: numeric(15,2)).

const MAXIMO_EM_CENTAVOS = 999_999_999_999_999;

// ---------- peças ----------

const placa = z
  .string({ error: "Informe a placa." })
  .transform(normalizarPlaca)
  .refine(placaNormalizadaValida, {
    error: "Placa inválida. Use três letras e quatro caracteres, como ABC1D23 ou ABC1234.",
  });

const id = (rotulo: string) =>
  z
    .string({ error: `Escolha ${rotulo}.` })
    .trim()
    .min(1, { error: `Escolha ${rotulo}.` });

const texto = (rotulo: string, maximo: number) =>
  z
    .string({ error: `Informe ${rotulo}.` })
    .trim()
    .min(1, { error: `Informe ${rotulo}.` })
    .max(maximo, { error: `Use até ${maximo} caracteres em ${rotulo}.` });

const centavos = (rotulo: string) =>
  z
    .number({ error: `Informe ${rotulo}.` })
    .int({ error: `Informe ${rotulo} em centavos inteiros.` })
    .positive({ error: `Informe ${rotulo} maior que zero.` })
    .max(MAXIMO_EM_CENTAVOS, { error: `Informe ${rotulo} menor que R$ 10 trilhões.` });

const versao = z
  .number({ error: "Falta a versão do registro que você viu." })
  .int()
  .min(1, { error: "Falta a versão do registro que você viu." });

// ---------- RENAVAM ----------

const PESOS_DO_RENAVAM = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function soDigitosDoRenavam(texto: string): string {
  return texto.replace(/[.\-\s]/g, "");
}

/** 11 dígitos com dígito verificador; o RENAVAM antigo de 9 ou 10 dígitos completa com zeros à esquerda. */
export function validarRenavam(texto: string): boolean {
  const digitos = soDigitosDoRenavam(texto);
  if (!/^\d{9,11}$/.test(digitos)) return false;
  const todos = digitos.padStart(11, "0");
  const soma = PESOS_DO_RENAVAM.reduce((acc, peso, i) => acc + Number(todos[i]) * peso, 0);
  const verificador = (soma * 10) % 11 === 10 ? 0 : (soma * 10) % 11;
  return verificador === Number(todos[10]);
}

const renavam = z
  .string({ error: "Informe o RENAVAM." })
  .refine(validarRenavam, { error: "RENAVAM inválido. Confira os 11 dígitos, com o dígito final." })
  .transform((t) => soDigitosDoRenavam(t).padStart(11, "0"));

// ---------- situação inicial por tipo ----------

/**
 * As situações que uma placa nova pode ter são as desta lista que o catálogo da régua aceita para o
 * tipo. Nunca baixa (SUC, VND), situação de operação nem folga e férias (decisão de 31/10/2026). O
 * SMo só vale para cavalo e caminhão: o apoio perdeu o SMo quando o catálogo substituiu a tabela
 * provisória (efeito aceito em 01/11/2026).
 */
const CANDIDATAS_A_SITUACAO_INICIAL: readonly Sigla[] = [
  "PÁT",
  "MAN",
  "REF",
  "SIN",
  "DOC",
  "SDo",
  "ALU",
  "EMP",
  "VEN",
  "SMo",
];

/** O padrão (PÁT) vem primeiro. */
export function siglasIniciaisDoTipo(tipo: TipoDeAtivo): Sigla[] {
  return CANDIDATAS_A_SITUACAO_INICIAL.filter((sigla) => siglaAceitaOTipo(sigla, tipo));
}

const siglaConhecida = z.enum(SIGLAS, { error: "Escolha uma situação da lista." });

// ---------- posse (operação e CR) ----------

type ComPosse = { operacaoId: string | null; crId: string | null };

function conferirPosse(dados: ComPosse, ctx: z.RefinementCtx) {
  if (dados.operacaoId !== null && dados.crId === null) {
    ctx.addIssue({
      code: "custom",
      path: ["crId"],
      message: "Escolha o CR da operação. Toda placa em operação tem um CR.",
    });
  }
  if (dados.operacaoId === null && dados.crId !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["operacaoId"],
      message: "Escolha a operação do CR, ou tire o CR.",
    });
  }
}

function conferirSituacao(tipo: TipoDeAtivo, situacao: Sigla, ctx: z.RefinementCtx, campo: string) {
  if (!siglasIniciaisDoTipo(tipo).includes(situacao)) {
    ctx.addIssue({
      code: "custom",
      path: [campo],
      message: "Esta situação não se aplica a este tipo de ativo. Escolha outra da lista.",
    });
  }
}

// ---------- cadastrar placa ----------

const FIPE = /^\d{6}-\d$/;

function dataValida(texto: string): boolean {
  const achado = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!achado) return false;
  const [ano, mes, dia] = [Number(achado[1]), Number(achado[2]), Number(achado[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/**
 * Cadastrar placa. `anoAtual` e `hoje` (`aaaa-mm-dd`) entram de fora para a regra ser pura e testável.
 * Cavalo e caminhão: código FIPE e valor FIPE digitados. Implemento, equipamento e apoio: valor
 * manual, fonte e data do valor. Sem conjunto no cadastro.
 */
export function esquemaCadastrarPlaca({ anoAtual, hoje }: { anoAtual: number; hoje: string }) {
  const identificacao = {
    placa,
    renavam,
    marcaId: id("a marca"),
    modeloId: id("o modelo"),
    ano: z
      .number({ error: "Informe o ano." })
      .int({ error: "Informe o ano com quatro dígitos." })
      .min(1980, { error: "O ano mínimo é 1980." })
      .max(anoAtual + 1, { error: `O ano máximo é ${anoAtual + 1}.` }),
    gestorId: id("o gestor de frota"),
    operacaoId: id("a operação").nullable(),
    crId: id("o CR").nullable(),
    filialId: id("a filial"),
    garagemId: id("a garagem"),
    situacaoInicial: siglaConhecida.default("PÁT"),
  };
  const comFipe = (tipo: "cavalo" | "caminhao") =>
    z.object({
      ...identificacao,
      tipo: z.literal(tipo),
      codigoFipe: z
        .string({ error: "Informe o código FIPE." })
        .trim()
        .regex(FIPE, { error: "Código FIPE inválido. Use o formato 000000-0." }),
      valorFipeCentavos: centavos("o valor FIPE"),
    });
  const comValorManual = (tipo: "implemento" | "equipamento" | "apoio") =>
    z.object({
      ...identificacao,
      tipo: z.literal(tipo),
      valorManualCentavos: centavos("o valor"),
      fonteDoValor: texto("a fonte do valor", 120),
      dataDoValor: z
        .string({ error: "Informe a data do valor." })
        .refine(dataValida, { error: "Data inválida. Use uma data real, como 10/09/2026." })
        .refine((d) => d <= hoje, { error: "A data do valor não pode ser no futuro." }),
    });
  return z
    .discriminatedUnion(
      "tipo",
      [
        comFipe("cavalo"),
        comFipe("caminhao"),
        comValorManual("implemento"),
        comValorManual("equipamento"),
        comValorManual("apoio"),
      ],
      { error: "Escolha o tipo de ativo." },
    )
    .superRefine((dados, ctx) => {
      conferirPosse(dados, ctx);
      conferirSituacao(dados.tipo, dados.situacaoInicial, ctx, "situacaoInicial");
    });
}

export type EntradaCadastrarPlaca = z.infer<ReturnType<typeof esquemaCadastrarPlaca>>;

// ---------- disponibilizar ao Operacional ----------

export const esquemaDisponibilizacao = z.object({
  placa,
  filialId: id("a filial"),
  /** A versão da placa que a pessoa viu (edição concorrente). */
  versaoDaPlaca: versao,
});
export type EntradaDisponibilizacao = z.infer<typeof esquemaDisponibilizacao>;

/**
 * O mesmo esquema, mais a regra do tipo (e, se vier a sigla, da situação de origem): só cavalo ou
 * caminhão vão ao Operacional, vindos de PÁT, VAz ou ETv. O servidor passa só o tipo (a situação, que
 * muda, é conferida pelo armazém depois da versão, para o conflito vir primeiro); a tela passa os dois.
 */
export function esquemaDisponibilizacaoDe({ tipo, sigla }: { tipo: TipoDeAtivo; sigla?: Sigla }) {
  return esquemaDisponibilizacao.superRefine((_dados, ctx) => {
    const motivo = motivoDeNaoDisponibilizar({ sigla: sigla ?? "PÁT", tipo });
    if (motivo !== null) ctx.addIssue({ code: "custom", path: ["placa"], message: motivo });
  });
}

// ---------- transferência entre gestores ----------

/** Quem envia deixa o motivo e as pendências conhecidas. */
export const esquemaEnvioDeTransferencia = z.object({
  placa,
  paraGestorId: id("o gestor que vai receber"),
  motivo: texto("o motivo da transferência", 300),
  pendenciasConhecidas: z.array(texto("a pendência", 200)).max(20, {
    error: "Use até 20 pendências. Agrupe as parecidas.",
  }),
});
export type EntradaEnvioDeTransferencia = z.infer<typeof esquemaEnvioDeTransferencia>;

/** Quem recebe confere o que chega, define o que muda, resolve as pendências e conclui. */
export function esquemaRecebimento(
  tipo: TipoDeAtivo,
  /** A carroceria de cada implemento candidato, por id: com ela, conjunto misto é recusado. */
  carroceriaDoImplemento?: Readonly<Record<string, string>>,
) {
  const situacoes = siglasIniciaisDoTipo(tipo) as [Sigla, ...Sigla[]];
  return z
    .object({
      placa,
      pedidoId: id("o pedido de transferência"),
      /** A versão do pedido e a da placa que a pessoa viu: se qualquer uma mudou, avisa. */
      versaoDoPedido: versao,
      versaoDaPlaca: versao,
      conferido: z.literal(true, { error: "Confira o que chegou antes de concluir." }),
      situacao: z.enum(situacoes, { error: "Escolha uma situação que se aplique a este tipo." }),
      operacaoId: id("a operação").nullable(),
      crId: id("o CR").nullable(),
      motoristaId: id("o motorista").nullable(),
      /** Meta do conjunto (ver docs/glossario.md): é do cavalo, o mestre; só ele a recebe. */
      metaDoConjuntoCentavos: centavos("a meta do conjunto").nullable(),
      conjunto: z.object({
        cavaloId: id("o cavalo").nullable(),
        implementoIds: z.array(id("o implemento")),
      }),
      pendencias: z.array(z.object({ id: z.string().min(1), resolvida: z.boolean() })),
    })
    .superRefine((dados, ctx) => {
      conferirPosse(dados, ctx);
      if (dados.pendencias.some((p) => !p.resolvida)) {
        ctx.addIssue({
          code: "custom",
          path: ["pendencias"],
          message: "Resolva todas as pendências antes de concluir.",
        });
      }
      const { cavaloId, implementoIds } = dados.conjunto;
      if (new Set(implementoIds).size !== implementoIds.length) {
        ctx.addIssue({
          code: "custom",
          path: ["conjunto", "implementoIds"],
          message: "Há implemento repetido no conjunto. Tire a repetição.",
        });
      }
      if (
        carroceriaDoImplemento &&
        conjuntoMisto(
          implementoIds.map((id) => carroceriaDoImplemento[id]).filter((c) => c !== undefined),
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["conjunto", "implementoIds"],
          message:
            "Conjunto misto não pode. Escolha implementos da mesma carroceria, como só Sider ou só Graneleiro.",
        });
      }
      if (tipo !== "cavalo" && implementoIds.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["conjunto", "implementoIds"],
          message: "Só o cavalo leva implementos. Tire os implementos deste conjunto.",
        });
      }
      if (tipo !== "cavalo" && dados.metaDoConjuntoCentavos !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["metaDoConjuntoCentavos"],
          message: "A meta do conjunto é do cavalo. Deixe-a vazia neste tipo de ativo.",
        });
      }
      if (tipo !== "implemento" && cavaloId !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["conjunto", "cavaloId"],
          message: "Só o implemento tem cavalo. Tire o cavalo deste conjunto.",
        });
      }
    });
}
export type EntradaRecebimento = z.infer<ReturnType<typeof esquemaRecebimento>>;

export { TIPOS_DE_ATIVO };

// ---------- itens de catálogo (o mini-wizard do "+") ----------

const nomeDoItem = z
  .string({ error: "Informe o nome." })
  .trim()
  .min(2, { error: "Informe o nome com pelo menos 2 letras." })
  .max(60, { error: "Use até 60 caracteres no nome." });

/** O que o "+" cria: marca, modelo (de uma marca), gestor, operação, CR (de uma operação), filial e garagem (de uma filial). */
export const esquemaItemDeCatalogo = z.discriminatedUnion(
  "tipo",
  [
    z.object({ tipo: z.literal("marca"), nome: nomeDoItem }),
    z.object({ tipo: z.literal("modelo"), nome: nomeDoItem, paiId: id("a marca") }),
    z.object({ tipo: z.literal("gestor"), nome: nomeDoItem }),
    z.object({ tipo: z.literal("operacao"), nome: nomeDoItem }),
    z.object({
      tipo: z.literal("cr"),
      nome: z
        .string({ error: "Informe o código do CR." })
        .trim()
        .regex(/^CR-\d{4}$/, { error: "Código inválido. Use o formato CR-0000." }),
      paiId: id("a operação"),
    }),
    z.object({ tipo: z.literal("filial"), nome: nomeDoItem }),
    z.object({ tipo: z.literal("garagem"), nome: nomeDoItem, paiId: id("a filial") }),
  ],
  { error: "Escolha o que cadastrar." },
);
export type EntradaItemDeCatalogo = z.infer<typeof esquemaItemDeCatalogo>;
export type TipoDeItemDeCatalogo = EntradaItemDeCatalogo["tipo"];
