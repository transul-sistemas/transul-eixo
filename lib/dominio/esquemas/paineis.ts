import { z } from "zod";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";

// Os assistentes das telas de painel da Fase 1 (Fechar e Reabrir o mês, Pedir ajuste, Registrar o
// status do dia, Indicar substituto, Lançar abastecimento). Uma definição só, lida pela tela (o
// resolvedor e os campos do popup) e pelo servidor (a Server Action valida com o MESMO esquema e
// confere a permissão). O banco confere de novo (função atômica com chave de envio).

export type TipoDoCampo = "selecao" | "texto" | "area" | "data" | "moeda" | "numero";

export interface CampoDoAssistente {
  id: string;
  rotulo: string;
  tipo: TipoDoCampo;
  /** Seleção: a chave das opções que a leitura da tela entrega (`opcoes.<chave>`), ou opções fixas. */
  opcoes?: string | readonly { id: string; nome: string }[];
  /** Seleção com busca: um campo de texto filtra as opções (lista de pessoas, por exemplo). */
  buscavel?: boolean;
  ajuda?: string;
}

export interface PassoDoPainel {
  id: string;
  titulo: string;
  campos: readonly CampoDoAssistente[];
}

export interface AssistenteDoPainel {
  id: string;
  /** Verbo + objeto, o mesmo do botão ao "concluído". */
  titulo: string;
  concluido: string;
  /** Lançamento provisório (sem fonte definitiva ainda): o popup avisa. */
  provisorio?: boolean;
  permissao: {
    modulo: "resultados" | "pessoas" | "frota" | "admin" | "parceiros" | "cadastros" | "inicio";
    acao: "criar" | "editar";
  };
  passos: readonly PassoDoPainel[];
  efeitos: readonly string[];
  /** A função do banco que grava (`nucleo.<nome>`). */
  funcao: string;
  /** As telas a atualizar depois de gravar. */
  rotas: readonly string[];
}

const MES = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Escolha o mês." });
const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Informe a data." });
const ID = z.string().min(1, { message: "Escolha uma opção." }).max(80);
const MOTIVO = z
  .string()
  .trim()
  .min(10, { message: "Explique o motivo com pelo menos 10 letras." })
  .max(500, { message: "Use até 500 caracteres." });

export const CODIGOS_DO_STATUS_DO_DIA = [
  { id: "TBV", nome: "TBV · trabalhou em viagem" },
  { id: "TBE", nome: "TBE · trabalhou em escala de base" },
  { id: "FOL", nome: "FOL · folga" },
  { id: "FÉR", nome: "FÉR · férias" },
  { id: "ATS", nome: "ATS · atestado" },
  { id: "FRD", nome: "FRD · feriado" },
  { id: "FLT", nome: "FLT · falta" },
  { id: "TBX", nome: "TBX · trabalhou em outra função" },
] as const;

/** A linha do resultado que o ajuste corrige (nucleo.pedir_ajuste). */
export const LINHAS_DO_AJUSTE = [
  { id: "receita", nome: "Receita" },
  { id: "custo_frota", nome: "Custo da frota" },
  { id: "custo_servico", nome: "Custo de serviço" },
] as const;

/** O ajuste tem sinal: soma ou subtrai do valor da linha. */
export const SENTIDOS_DO_AJUSTE = [
  { id: "somar", nome: "Somar à linha" },
  { id: "subtrair", nome: "Subtrair da linha" },
] as const;

export const DECISOES_DO_PROVISORIO = [
  { id: "conferido", nome: "Conferido com o Sankhya" },
  { id: "descartado", nome: "Descartar o lançamento" },
] as const;

export const DECISOES_DO_AJUSTE = [
  { id: "aprovado", nome: "Aprovar" },
  { id: "recusado", nome: "Recusar" },
] as const;

export const ESQUEMAS_DOS_PAINEIS = {
  "fechar-mes": z.object({ mes: MES }),
  "reabrir-mes": z.object({ mes: MES, motivo: MOTIVO }),
  "pedir-ajuste": z.object({
    mes: MES,
    operacaoId: ID,
    linha: z.enum(["receita", "custo_frota", "custo_servico"], {
      message: "Escolha a linha: receita, custo da frota ou custo de serviço.",
    }),
    sentido: z.enum(["somar", "subtrair"], { message: "Diga se o ajuste soma ou subtrai." }),
    valorCentavos: z
      .number({ message: "Informe o valor." })
      .int()
      .min(1, { message: "Informe o valor maior que zero." }),
    justificativa: MOTIVO,
  }),
  "decidir-ajuste": z
    .object({
      ajuste: z.string().regex(/^[^:]+:\d+$/, { message: "Escolha o ajuste pedido." }),
      decisao: z.enum(["aprovado", "recusado"], { message: "Escolha aprovar ou recusar." }),
      motivo: z.string().trim().max(500, { message: "Use até 500 caracteres." }),
    })
    .refine((d) => d.decisao === "aprovado" || d.motivo.length > 0, {
      message: "Recusar o ajuste pede o motivo.",
      path: ["motivo"],
    }),
  "conferir-abastecimento": z
    .object({
      provisorio: z.string().regex(/^[^:]+:\d+$/, { message: "Escolha o lançamento provisório." }),
      decisao: z.enum(["conferido", "descartado"], { message: "Escolha conferir ou descartar." }),
      origemId: z.string().trim().max(60, { message: "Use até 60 caracteres." }),
      motivo: z.string().trim().max(500, { message: "Use até 500 caracteres." }),
    })
    .refine((d) => d.decisao !== "conferido" || d.origemId.length > 0, {
      message: "Informe o identificador do abastecimento no Sankhya.",
      path: ["origemId"],
    })
    .refine((d) => d.decisao !== "descartado" || d.motivo.length > 0, {
      message: "Descartar o lançamento pede o motivo.",
      path: ["motivo"],
    }),
  "registrar-status-do-dia": z.object({
    pessoaId: ID,
    dia: DIA,
    codigo: z.enum(CODIGOS_DO_STATUS_DO_DIA.map((c) => c.id) as [string, ...string[]], {
      message: "Escolha o status do dia.",
    }),
    observacao: z.string().max(200, { message: "Use até 200 caracteres." }),
  }),
  "indicar-substituto": z
    .object({
      motoristaId: ID,
      substitutoId: ID,
      inicio: DIA,
      fim: DIA,
      motivo: z
        .string()
        .trim()
        .min(3, { message: "Diga o motivo (férias, atestado...)." })
        .max(200, { message: "Use até 200 caracteres." }),
    })
    .refine((d) => d.substitutoId !== d.motoristaId, {
      message: "O substituto precisa ser outra pessoa.",
      path: ["substitutoId"],
    })
    // Período [início, fim): o fim é o dia em que o titular volta, sempre depois do início.
    .refine((d) => d.fim > d.inicio, {
      message: "O fim fica depois do início (é o dia em que o titular volta).",
      path: ["fim"],
    }),
  "lancar-abastecimento": z.object({
    placa: z.string().transform(normalizarPlaca).refine(placaNormalizadaValida, {
      message: "Digite a placa completa, com 3 letras e 4 números ou letras (ex.: ABC1D23).",
    }),
    dia: DIA,
    litros: z
      .number({ message: "Informe os litros." })
      .positive({ message: "Informe os litros maior que zero." })
      .max(2000, { message: "Confira os litros: mais de 2.000 num abastecimento." }),
    hodometro: z
      .number({ message: "Informe o hodômetro." })
      .int({ message: "Informe o hodômetro sem casas." })
      .min(0, { message: "O hodômetro não pode ser negativo." }),
    valorCentavos: z
      .number({ message: "Informe o valor." })
      .int()
      .min(1, { message: "Informe o valor maior que zero." }),
  }),
  "reatribuir-tarefa": z.object({
    tarefa: z.string().regex(/^[^:]+:\d+$/, { message: "Escolha a tarefa." }),
    pessoaId: ID,
    motivo: MOTIVO,
  }),
  "delegar-tarefas": z
    .object({
      deId: ID,
      paraId: ID,
      inicio: DIA,
      fim: DIA,
      motivo: z
        .string()
        .trim()
        .min(3, { message: "Diga o motivo (férias, viagem...)." })
        .max(200, { message: "Use até 200 caracteres." }),
    })
    .refine((d) => d.paraId !== d.deId, {
      message: "Quem cobre precisa ser outra pessoa.",
      path: ["paraId"],
    })
    // Período [início, fim): o fim é o dia em que a pessoa volta, sempre depois do início.
    .refine((d) => d.fim > d.inicio, {
      message: "O fim fica depois do início (é o dia em que a pessoa volta).",
      path: ["fim"],
    }),
} as const;

export type IdDoAssistenteDoPainel = keyof typeof ESQUEMAS_DOS_PAINEIS;

export const ASSISTENTES_DOS_PAINEIS: Record<IdDoAssistenteDoPainel, AssistenteDoPainel> = {
  "fechar-mes": {
    id: "fechar-mes",
    titulo: "Fechar mês",
    concluido: "Mês fechado.",
    permissao: { modulo: "resultados", acao: "editar" },
    passos: [
      {
        id: "mes",
        titulo: "Mês",
        campos: [{ id: "mes", rotulo: "Mês a fechar", tipo: "selecao", opcoes: "mesesAbertos" }],
      },
    ],
    efeitos: [
      "Os totais do mês ficam gravados na foto do fechamento e não mudam depois.",
      "Corrigir um mês fechado é só por ajuste justificado (Resultados › Ajustes).",
    ],
    funcao: "fechar_mes",
    rotas: ["/resultados/fechamentos", "/resultados/visao-geral", "/resultados/por-operacao"],
  },
  "reabrir-mes": {
    id: "reabrir-mes",
    titulo: "Reabrir mês",
    concluido: "Mês reaberto.",
    permissao: { modulo: "resultados", acao: "editar" },
    passos: [
      {
        id: "mes",
        titulo: "Mês",
        campos: [{ id: "mes", rotulo: "Mês a reabrir", tipo: "selecao", opcoes: "mesesFechados" }],
      },
      {
        id: "motivo",
        titulo: "Motivo",
        campos: [{ id: "motivo", rotulo: "Por que reabrir", tipo: "area" }],
      },
    ],
    efeitos: [
      "A foto do mês deixa de valer e o mês volta a mostrar os números vivos.",
      "O motivo fica registrado no histórico de fechamentos.",
    ],
    funcao: "reabrir_mes",
    rotas: ["/resultados/fechamentos", "/resultados/visao-geral", "/resultados/por-operacao"],
  },
  "pedir-ajuste": {
    id: "pedir-ajuste",
    titulo: "Pedir ajuste",
    concluido: "Ajuste pedido.",
    permissao: { modulo: "resultados", acao: "criar" },
    passos: [
      {
        id: "valor",
        titulo: "Valor e destino",
        campos: [
          { id: "mes", rotulo: "Mês", tipo: "selecao", opcoes: "meses" },
          { id: "operacaoId", rotulo: "Operação", tipo: "selecao", opcoes: "operacoes" },
          { id: "linha", rotulo: "Linha do resultado", tipo: "selecao", opcoes: LINHAS_DO_AJUSTE },
          { id: "sentido", rotulo: "Sentido", tipo: "selecao", opcoes: SENTIDOS_DO_AJUSTE },
          { id: "valorCentavos", rotulo: "Valor do ajuste", tipo: "moeda" },
        ],
      },
      {
        id: "justificativa",
        titulo: "Justificativa",
        campos: [{ id: "justificativa", rotulo: "Por que ajustar", tipo: "area" }],
      },
    ],
    efeitos: [
      "O fato importado do Sankhya não muda: o ajuste fica ao lado, com a justificativa.",
      "O ajuste só entra no resultado depois de aprovado pela alçada; quem pede não aprova.",
    ],
    funcao: "pedir_ajuste",
    rotas: ["/resultados/ajustes"],
  },
  "decidir-ajuste": {
    id: "decidir-ajuste",
    titulo: "Decidir ajuste",
    concluido: "Ajuste decidido.",
    permissao: { modulo: "resultados", acao: "editar" },
    passos: [
      {
        id: "decisao",
        titulo: "Ajuste e decisão",
        campos: [
          { id: "ajuste", rotulo: "Ajuste pedido", tipo: "selecao", opcoes: "ajustesPedidos" },
          { id: "decisao", rotulo: "Decisão", tipo: "selecao", opcoes: DECISOES_DO_AJUSTE },
          { id: "motivo", rotulo: "Motivo (obrigatório para recusar)", tipo: "area" },
        ],
      },
    ],
    efeitos: [
      "Só a Diretoria decide, e quem pediu o ajuste não decide.",
      "Aprovado, o ajuste entra no resultado do mês ao lado do fato; recusado, fica registrado com o motivo.",
    ],
    funcao: "decidir_ajuste",
    rotas: ["/resultados/ajustes", "/resultados/visao-geral"],
  },
  "conferir-abastecimento": {
    id: "conferir-abastecimento",
    titulo: "Conferir abastecimento",
    concluido: "Abastecimento conferido.",
    permissao: { modulo: "frota", acao: "criar" },
    passos: [
      {
        id: "conferencia",
        titulo: "Lançamento e decisão",
        campos: [
          {
            id: "provisorio",
            rotulo: "Lançamento provisório",
            tipo: "selecao",
            opcoes: "provisorios",
          },
          { id: "decisao", rotulo: "Decisão", tipo: "selecao", opcoes: DECISOES_DO_PROVISORIO },
          {
            id: "origemId",
            rotulo: "Identificador no Sankhya (para conferir)",
            tipo: "texto",
            ajuda: "O abastecimento do Sankhya da mesma placa que corresponde a este lançamento.",
          },
          { id: "motivo", rotulo: "Motivo (obrigatório para descartar)", tipo: "area" },
        ],
      },
    ],
    efeitos: [
      "Conferido, o lançamento sai dos provisórios: o abastecimento do Sankhya passa a valer.",
      "Descartado, sai dos provisórios com o motivo; nada é apagado.",
    ],
    funcao: "conferir_abastecimento_provisorio",
    rotas: ["/frota/abastecimento"],
  },
  "registrar-status-do-dia": {
    id: "registrar-status-do-dia",
    titulo: "Registrar status do dia",
    concluido: "Status do dia registrado.",
    permissao: { modulo: "pessoas", acao: "editar" },
    passos: [
      {
        id: "status",
        titulo: "Pessoa e status",
        campos: [
          { id: "pessoaId", rotulo: "Motorista", tipo: "selecao", opcoes: "motoristas" },
          { id: "dia", rotulo: "Dia", tipo: "data" },
          {
            id: "codigo",
            rotulo: "Status do dia",
            tipo: "selecao",
            opcoes: CODIGOS_DO_STATUS_DO_DIA,
          },
          {
            id: "observacao",
            rotulo: "Motivo da correção (só ao trocar um dia já lançado)",
            tipo: "texto",
          },
        ],
      },
    ],
    efeitos: [
      "O status do dia é o realizado: a escala do mês continua como planejado.",
      "Folga ou férias sem substituto deixa o conjunto sem motorista (SMo).",
    ],
    funcao: "lancar_status_do_motorista",
    rotas: ["/pessoas/status-diario", "/pessoas/escala", "/frota/acompanhamento"],
  },
  "indicar-substituto": {
    id: "indicar-substituto",
    titulo: "Indicar substituto",
    concluido: "Substituto indicado.",
    permissao: { modulo: "pessoas", acao: "editar" },
    passos: [
      {
        id: "motorista",
        titulo: "Motorista e período",
        campos: [
          { id: "motoristaId", rotulo: "Motorista ausente", tipo: "selecao", opcoes: "motoristas" },
          { id: "inicio", rotulo: "Início", tipo: "data" },
          {
            id: "fim",
            rotulo: "Volta do titular",
            tipo: "data",
            ajuda: "O dia em que o titular volta (não entra no período).",
          },
          { id: "motivo", rotulo: "Motivo", tipo: "texto" },
        ],
      },
      {
        id: "substituto",
        titulo: "Substituto",
        campos: [
          { id: "substitutoId", rotulo: "Substituto", tipo: "selecao", opcoes: "substitutos" },
        ],
      },
    ],
    efeitos: [
      "O substituto assume o conjunto do motorista no período; depois volta o titular.",
      'A tarefa "Indicar substituto" do motorista se fecha.',
    ],
    funcao: "indicar_substituto",
    rotas: ["/pessoas/status-diario", "/frota/acompanhamento", "/inicio/tarefas"],
  },
  "lancar-abastecimento": {
    id: "lancar-abastecimento",
    titulo: "Lançar abastecimento",
    concluido: "Abastecimento lançado.",
    provisorio: true,
    permissao: { modulo: "frota", acao: "criar" },
    passos: [
      {
        id: "abastecimento",
        titulo: "Abastecimento",
        campos: [
          { id: "placa", rotulo: "Placa", tipo: "texto" },
          { id: "dia", rotulo: "Dia", tipo: "data" },
          { id: "litros", rotulo: "Litros", tipo: "numero" },
          { id: "hodometro", rotulo: "Hodômetro (km)", tipo: "numero" },
          { id: "valorCentavos", rotulo: "Valor", tipo: "moeda" },
        ],
      },
    ],
    efeitos: [
      "Lançamento provisório: o Sankhya continua a fonte do abastecimento.",
      "Quando o mesmo abastecimento chegar do Sankhya, o provisório é conferido e substituído.",
    ],
    funcao: "lancar_abastecimento_provisorio",
    rotas: ["/frota/abastecimento"],
  },
  "reatribuir-tarefa": {
    id: "reatribuir-tarefa",
    titulo: "Reatribuir tarefa",
    concluido: "Tarefa reatribuída.",
    permissao: { modulo: "admin", acao: "editar" },
    passos: [
      {
        id: "tarefa",
        titulo: "Tarefa e novo dono",
        campos: [
          { id: "tarefa", rotulo: "Tarefa", tipo: "selecao", opcoes: "tarefas" },
          {
            id: "pessoaId",
            rotulo: "Novo dono",
            tipo: "selecao",
            opcoes: "pessoas",
            buscavel: true,
          },
        ],
      },
      {
        id: "motivo",
        titulo: "Motivo",
        campos: [{ id: "motivo", rotulo: "Por que reatribuir", tipo: "area" }],
      },
    ],
    efeitos: [
      "Quem recebe passa a ser o dono da tarefa, com o mesmo prazo; o motivo fica no histórico.",
      "Reatribuir não age em nome de ninguém: o novo dono é quem conclui a tarefa.",
    ],
    funcao: "reatribuir_tarefa",
    rotas: ["/admin/painel-de-processos", "/admin/processos", "/inicio/tarefas"],
  },
  "delegar-tarefas": {
    id: "delegar-tarefas",
    titulo: "Delegar tarefas",
    concluido: "Tarefas delegadas.",
    permissao: { modulo: "admin", acao: "editar" },
    passos: [
      {
        id: "quem",
        titulo: "Quem cobre",
        campos: [
          {
            id: "deId",
            rotulo: "Quem se ausenta",
            tipo: "selecao",
            opcoes: "pessoas",
            buscavel: true,
          },
          {
            id: "paraId",
            rotulo: "Quem cobre",
            tipo: "selecao",
            opcoes: "pessoas",
            buscavel: true,
          },
        ],
      },
      {
        id: "periodo",
        titulo: "Período",
        campos: [
          { id: "inicio", rotulo: "Início", tipo: "data" },
          {
            id: "fim",
            rotulo: "Volta",
            tipo: "data",
            ajuda: "O dia em que a pessoa volta (não entra no período).",
          },
          { id: "motivo", rotulo: "Motivo", tipo: "texto" },
        ],
      },
    ],
    efeitos: [
      "As tarefas de quem se ausenta vão para quem cobre durante o período e voltam sozinhas no fim.",
      "Fora do período, a tarefa volta ao dono; nada é apagado.",
    ],
    funcao: "delegar_tarefas",
    rotas: ["/admin/processos", "/admin/painel-de-processos", "/inicio/tarefas"],
  },
};

/** Os valores iniciais do formulário de um assistente (data de hoje nos campos de data). */
export function valoresIniciaisDoAssistente(
  id: IdDoAssistenteDoPainel,
  hoje: string,
): Record<string, string | number> {
  const valores: Record<string, string | number> = {};
  for (const passo of ASSISTENTES_DOS_PAINEIS[id].passos) {
    for (const c of passo.campos) {
      valores[c.id] = c.tipo === "data" ? hoje : c.tipo === "moeda" || c.tipo === "numero" ? 0 : "";
    }
  }
  return valores;
}

/** Os argumentos da função do banco (dinheiro em reais, como o banco guarda). */
export function argumentosDoBanco(
  id: IdDoAssistenteDoPainel,
  dados: Record<string, unknown>,
  chave: string,
): Record<string, unknown> {
  const reais = (c: unknown) => Number(c) / 100;
  switch (id) {
    case "fechar-mes":
      return { p_mes: `${dados.mes}-01`, p_chave: chave };
    case "reabrir-mes":
      return { p_mes: `${dados.mes}-01`, p_motivo: dados.motivo, p_chave: chave };
    case "pedir-ajuste":
      return {
        p_mes: `${dados.mes}-01`,
        p_operacao_id: dados.operacaoId,
        p_cr_id: null,
        p_linha: dados.linha,
        // O banco guarda o ajuste com sinal.
        p_valor: (dados.sentido === "subtrair" ? -1 : 1) * reais(dados.valorCentavos),
        p_justificativa: dados.justificativa,
        p_chave: chave,
      };
    case "decidir-ajuste": {
      const [ajusteId, versao] = String(dados.ajuste).split(":");
      return {
        p_ajuste_id: ajusteId,
        p_versao: Number(versao),
        p_decisao: dados.decisao,
        p_motivo: dados.motivo || null,
        p_chave: chave,
      };
    }
    case "conferir-abastecimento": {
      const [provisorioId, versao] = String(dados.provisorio).split(":");
      return {
        p_id: provisorioId,
        p_versao: Number(versao),
        p_decisao: dados.decisao,
        p_origem_id: dados.decisao === "conferido" ? dados.origemId : null,
        p_motivo: dados.motivo || null,
        p_chave: chave,
      };
    }
    case "registrar-status-do-dia":
      return {
        p_pessoa_id: dados.pessoaId,
        p_dia: dados.dia,
        p_codigo: dados.codigo,
        p_versao: null,
        p_motivo: dados.observacao || null,
        p_chave: chave,
      };
    case "indicar-substituto":
      return {
        p_titular_id: dados.motoristaId,
        p_substituto_id: dados.substitutoId,
        p_inicio: dados.inicio,
        p_fim: dados.fim,
        p_motivo: dados.motivo,
        p_chave: chave,
      };
    case "lancar-abastecimento":
      // O banco recebe o ativo (a leitura da placa → ativo é feita antes, em lib/dados/paineis.ts).
      return {
        p_ativo_id: dados.ativoId,
        p_dia: dados.dia,
        p_litros: dados.litros,
        p_valor: reais(dados.valorCentavos),
        p_km: dados.hodometro,
        p_combustivel: null,
        p_posto: null,
        p_chave: chave,
      };
    case "reatribuir-tarefa": {
      const [tarefaId, versao] = String(dados.tarefa).split(":");
      return {
        p_tarefa_id: tarefaId,
        p_versao: Number(versao),
        p_pessoa_id: dados.pessoaId,
        p_motivo: dados.motivo,
        p_chave: chave,
      };
    }
    case "delegar-tarefas":
      return {
        p_de: dados.deId,
        p_para: dados.paraId,
        p_inicio: dados.inicio,
        p_fim: dados.fim,
        p_motivo: dados.motivo,
        p_chave: chave,
      };
  }
}
