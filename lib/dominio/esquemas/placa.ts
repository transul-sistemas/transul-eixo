import { z } from "zod";
import { TIPOS_DE_ATIVO, type TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { FUNCOES_DO_IMPLEMENTO } from "../carroceria";
import { normalizarPlaca, placaNormalizadaValida } from "../placa";
import { motivoDeNaoEntregar } from "../custodia";
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

/** Eixos do semirreboque: de 1 a 6 (o simples vai de 1 a 6; o dolly tem sempre 2). */
export const EIXOS_DO_SEMIRREBOQUE = [1, 2, 3, 4, 5, 6] as const;

/**
 * A regra da função, da carroceria e dos eixos do implemento, sozinha: o semirreboque precisa de
 * carroceria e de 1 a 6 eixos; o dolly não tem carroceria e tem sempre 2 eixos. Fica fora do esquema
 * para a tela conferir no passo Veículo (o Zod só roda o `transform` quando o resto do formulário
 * já passou); o esquema chama a mesma função.
 */
export function problemasDoImplemento({
  funcao,
  carroceriaId,
  eixos,
}: {
  funcao?: string | null;
  carroceriaId?: string | null;
  eixos?: number | null;
}): { path: string[]; message: string }[] {
  const temCarroceria = !!carroceriaId && carroceriaId.trim() !== "";
  const problemas: { path: string[]; message: string }[] = [];
  if (funcao === "dolly") {
    if (temCarroceria)
      problemas.push({ path: ["carroceriaId"], message: "O dolly não tem carroceria." });
    if (eixos != null && eixos !== 2) {
      problemas.push({ path: ["eixos"], message: "O dolly tem sempre 2 eixos." });
    }
    return problemas;
  }
  if (funcao !== "semirreboque") return problemas;
  if (!temCarroceria) {
    problemas.push({
      path: ["carroceriaId"],
      message: "O semirreboque precisa de carroceria. Escolha uma da lista.",
    });
  }
  if (eixos == null || !(EIXOS_DO_SEMIRREBOQUE as readonly number[]).includes(eixos)) {
    problemas.push({ path: ["eixos"], message: "Informe os eixos do semirreboque, de 1 a 6." });
  }
  return problemas;
}

/**
 * Cadastrar placa. `anoAtual` e `hoje` (`aaaa-mm-dd`) entram de fora para a regra ser pura e testável.
 * Cavalo e caminhão: código FIPE e valor FIPE digitados. Implemento, equipamento e apoio: valor
 * manual, fonte e data do valor. O implemento diz a função (semirreboque ou dolly), a carroceria e os
 * eixos (o dolly não tem carroceria e tem sempre 2 eixos). Operação e CR obrigatórios (3.7). Sem
 * filial nem garagem: a garagem é a do CR (calculada no banco). Sem conjunto no cadastro.
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
    operacaoId: id("a operação"),
    crId: id("o CR"),
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
  const valorManual = {
    valorManualCentavos: centavos("o valor"),
    fonteDoValor: texto("a fonte do valor", 120),
    dataDoValor: z
      .string({ error: "Informe a data do valor." })
      .refine(dataValida, { error: "Data inválida. Use uma data real, como 10/09/2026." })
      .refine((d) => d <= hoje, { error: "A data do valor não pode ser no futuro." }),
  };
  const comValorManual = (tipo: "equipamento" | "apoio") =>
    z.object({ ...identificacao, tipo: z.literal(tipo), ...valorManual });
  const doImplemento = z
    .object({
      ...identificacao,
      tipo: z.literal("implemento"),
      ...valorManual,
      funcao: z.enum(FUNCOES_DO_IMPLEMENTO, {
        error: "Escolha a função do implemento: semirreboque ou dolly.",
      }),
      carroceriaId: z.string().trim().nullish(),
      eixos: z.number().nullish(),
    })
    .transform((dados, ctx) => {
      for (const problema of problemasDoImplemento(dados)) {
        ctx.addIssue({ code: "custom", path: problema.path, message: problema.message });
      }
      return dados.funcao === "dolly"
        ? { ...dados, carroceriaId: null, eixos: 2 }
        : { ...dados, carroceriaId: dados.carroceriaId || null, eixos: dados.eixos ?? null };
    });
  return z
    .discriminatedUnion(
      "tipo",
      [
        comFipe("cavalo"),
        comFipe("caminhao"),
        doImplemento,
        comValorManual("equipamento"),
        comValorManual("apoio"),
      ],
      { error: "Escolha o tipo de ativo." },
    )
    .superRefine((dados, ctx) => {
      conferirSituacao(dados.tipo, dados.situacaoInicial, ctx, "situacaoInicial");
    });
}

export type EntradaCadastrarPlaca = z.infer<ReturnType<typeof esquemaCadastrarPlaca>>;

// ---------- entregar ao Operacional ----------

export const esquemaEntregaAoOperacional = z.object({
  placa,
  filialId: id("a filial"),
  /** A versão da placa que a pessoa viu (edição concorrente). */
  versaoDaPlaca: versao,
});
export type EntradaEntregaAoOperacional = z.infer<typeof esquemaEntregaAoOperacional>;

/**
 * O mesmo esquema, mais a regra do tipo (e, se vier a sigla, da situação de origem): só cavalo ou
 * caminhão vão ao Operacional, vindos de PÁT ou ETv. O servidor passa só o tipo (a situação, que
 * muda, é conferida depois da versão, para o conflito vir primeiro); a tela passa os dois.
 */
export function esquemaEntregaAoOperacionalDe({
  tipo,
  sigla,
}: {
  tipo: TipoDeAtivo;
  sigla?: Sigla;
}) {
  return esquemaEntregaAoOperacional.superRefine((_dados, ctx) => {
    const motivo = motivoDeNaoEntregar({ sigla: sigla ?? "PÁT", tipo });
    if (motivo !== null) ctx.addIssue({ code: "custom", path: ["placa"], message: motivo });
  });
}

// ---------- disponibilizar placa (enviar a outro gestor de frota) ----------

/** Quem envia deixa o destino, o motivo e as pendências conhecidas, com a versão da placa que viu. */
export const esquemaDisponibilizarPlaca = z.object({
  placa,
  paraGestorId: id("o gestor que vai receber"),
  motivo: texto("o motivo", 300),
  pendenciasConhecidas: z.array(texto("a pendência", 200)).max(20, {
    error: "Use até 20 pendências. Agrupe as parecidas.",
  }),
  versaoDaPlaca: versao,
});
export type EntradaDisponibilizarPlaca = z.infer<typeof esquemaDisponibilizarPlaca>;

// ---------- receber placa (duas etapas) ----------

/** Receber placa: registra a chegada (o gestor ainda não muda). */
export const esquemaReceberPlaca = z.object({
  placa,
  pedidoId: id("o pedido de transferência"),
  /** A versão do pedido que a pessoa viu: se mudou, avisa. */
  versaoDoPedido: versao,
  conferido: z.literal(true, { error: "Confira o que chegou antes de receber." }),
});
export type EntradaReceberPlaca = z.infer<typeof esquemaReceberPlaca>;

/** Concluir recebimento: cada pendência resolvida (sim ou não, com nota quando não) e a troca do gestor. */
export const esquemaConcluirRecebimento = z
  .object({
    placa,
    pedidoId: id("o pedido de transferência"),
    versaoDoPedido: versao,
    pendencias: z.array(
      z.object({
        id: z.string().min(1),
        resolvida: z.boolean({ error: "Diga se a pendência foi resolvida." }),
        nota: z
          .string()
          .max(300, { error: "Use até 300 caracteres na nota." })
          .nullish()
          .transform((n) => (n == null || n.trim() === "" ? null : n.trim())),
      }),
    ),
  })
  .superRefine((dados, ctx) => {
    dados.pendencias.forEach((p, i) => {
      if (!p.resolvida && p.nota === null) {
        ctx.addIssue({
          code: "custom",
          path: ["pendencias", i, "nota"],
          message: "Diga na nota o que ficou pendente.",
        });
      }
    });
    if (new Set(dados.pendencias.map((p) => p.id)).size !== dados.pendencias.length) {
      ctx.addIssue({
        code: "custom",
        path: ["pendencias"],
        message: "Responda cada pendência do pedido, uma vez.",
      });
    }
  });
export type EntradaConcluirRecebimento = z.infer<typeof esquemaConcluirRecebimento>;

// ---------- cancelar e devolver o pedido ----------

/** Cancelar pedido: a origem desiste do pedido pendente, confirmando. */
export const esquemaCancelarPedido = z.object({
  placa,
  pedidoId: id("o pedido de transferência"),
  versaoDoPedido: versao,
  confirmado: z.literal(true, { error: "Confirme que quer cancelar o pedido." }),
});
export type EntradaCancelarPedido = z.infer<typeof esquemaCancelarPedido>;

/** Devolver placa: o destino recusa o pedido em conferência, com o motivo. */
export const esquemaDevolverPlaca = z.object({
  placa,
  pedidoId: id("o pedido de transferência"),
  versaoDoPedido: versao,
  motivo: texto("o motivo", 300),
});
export type EntradaDevolverPlaca = z.infer<typeof esquemaDevolverPlaca>;

export { TIPOS_DE_ATIVO };

// ---------- itens de catálogo (o mini-wizard do "+") ----------

const nomeDoItem = z
  .string({ error: "Informe o nome." })
  .trim()
  .min(2, { error: "Informe o nome com pelo menos 2 letras." })
  .max(60, { error: "Use até 60 caracteres no nome." });

/**
 * O que o "+" cria: marca, modelo (de uma marca), gestor, operação, CR e filial. O CR pede o código
 * do Sankhya (CODCENCUS, obrigatório: todo CR vem do Sankhya); a operação dele é opcional. A garagem
 * saiu: garagem é a filial (as 3).
 */
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
        .min(2, { error: "Informe o código do CR com pelo menos 2 caracteres." })
        .max(60, { error: "Use até 60 caracteres no código do CR." }),
      codcencus: z
        .number({ error: "Informe o código do Sankhya (CODCENCUS)." })
        .int({ error: "O código do Sankhya é um número inteiro." })
        .positive({ error: "O código do Sankhya é um número inteiro maior que zero." })
        .max(Number.MAX_SAFE_INTEGER, { error: "O código do Sankhya é grande demais." }),
      paiId: id("a operação").optional(),
    }),
    z.object({ tipo: z.literal("filial"), nome: nomeDoItem }),
  ],
  { error: "Escolha o que cadastrar." },
);
export type EntradaItemDeCatalogo = z.infer<typeof esquemaItemDeCatalogo>;
export type TipoDeItemDeCatalogo = EntradaItemDeCatalogo["tipo"];
