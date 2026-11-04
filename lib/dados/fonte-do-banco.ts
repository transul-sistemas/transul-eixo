import { alertaDoBanco } from "@/lib/dominio/alertas";
import { SIGLAS, type Sigla } from "@/lib/dominio/status";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { STATUS, type Status } from "@/lib/visual/tons";
import type { FonteDePlacas } from "./fonte";
import {
  type DetalheDaPlaca,
  type FichaDaPlaca,
  type LinhaDePlaca,
  type PaginaDePlacas,
  TIPOS_DE_ATIVO,
  type TipoDeAtivo,
} from "./placas-tipos";

// A fonte do banco (fatia 3.9a): a lista, o painel e a ficha leem do Supabase com a sessão de quem
// usa, então a RLS decide o que cada perfil vê. Quem filtra, ordena, pagina e conta é o banco
// (nucleo.listar_placas e as irmãs); aqui só se converte o que ele devolve para o formato da tela.

/** O pedaço do cliente do Supabase que a leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDeLeitura {
  schema(esquema: "nucleo"): {
    rpc(
      funcao: string,
      argumentos?: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}

/** Uma linha como o banco devolve (`nucleo.linha_de_placa` em JSON). */
interface LinhaDoBanco {
  id: string;
  placa: string;
  tipo: string;
  modelo: string;
  cavalo: string | null;
  implementos: string[] | null;
  gestor: string | null;
  operacao: string | null;
  cr: string | null;
  sigla: string;
  nome_da_situacao: string | null;
  grupo: string | null;
  desde: string | null;
  dias_no_status: number | null;
  alertas: string[] | null;
  valor_fipe: number | null;
  filial: string | null;
  ano: number | null;
  renavam: string | null;
}

interface VigenciaDoBanco {
  codigo: string;
  nome: string;
  inicio: string;
  fim: string | null;
}

interface DetalheDoBanco extends LinhaDoBanco {
  crs: VigenciaDoBanco[] | null;
  crs_vigentes: VigenciaDoBanco[] | null;
}

async function chamar<T>(cliente: ClienteDeLeitura, funcao: string, argumentos: object) {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc(funcao, argumentos as Record<string, unknown>);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

function sigla(valor: string): Sigla {
  if (!(SIGLAS as readonly string[]).includes(valor)) {
    throw new Error(`Situação que a tela não conhece: ${valor}`);
  }
  return valor as Sigla;
}

function tipo(valor: string): TipoDeAtivo {
  if (!(TIPOS_DE_ATIVO as readonly string[]).includes(valor)) {
    throw new Error(`Tipo de ativo que a tela não conhece: ${valor}`);
  }
  return valor as TipoDeAtivo;
}

function grupo(valor: string | null): Status {
  if (valor === null || !(STATUS as readonly string[]).includes(valor)) {
    throw new Error(`Grupo de situação que a tela não conhece: ${String(valor)}`);
  }
  return valor as Status;
}

function paraLinha(l: LinhaDoBanco): LinhaDePlaca {
  return {
    id: l.id,
    placa: l.placa,
    tipo: tipo(l.tipo),
    modelo: l.modelo,
    conjunto: { cavalo: l.cavalo, implementos: l.implementos ?? [] },
    gestor: l.gestor ?? "Sem gestor",
    operacao: l.operacao,
    cr: l.cr,
    sigla: sigla(l.sigla),
    nomeDaSituacao: l.nome_da_situacao ?? l.sigla,
    grupo: grupo(l.grupo),
    diasNoStatus: Math.max(0, l.dias_no_status ?? 0),
    alertas: (l.alertas ?? []).map(alertaDoBanco),
    // KM, motorista e CRLV ainda não existem no banco: ficam vazios no modo banco.
    km: null,
    valorFipeCentavos: l.valor_fipe === null ? null : Math.round(l.valor_fipe * 100),
    motorista: null,
    crlvVenceEm: null,
    filial: l.filial ?? "Sem filial",
  };
}

function paraDetalhe(d: DetalheDoBanco): DetalheDaPlaca {
  return {
    ...paraLinha(d),
    ano: d.ano,
    renavam: d.renavam ?? "",
    desde: d.desde ?? "",
    crs: (d.crs ?? []).map((c) => ({ ...c })),
    crsVigentes: (d.crs_vigentes ?? []).map((c) => ({ ...c })),
  };
}

/** Os chips da consulta separados em grupos de situação e tipos de ativo. */
function filtros(consulta: ConsultaDeTabela) {
  return {
    p_busca: consulta.busca,
    p_grupos: consulta.chips.filter((c) => (STATUS as readonly string[]).includes(c)),
    p_tipos: consulta.chips.filter((c) => (TIPOS_DE_ATIVO as readonly string[]).includes(c)),
    p_siglas: consulta.siglas,
    p_baixadas: consulta.baixadas,
  };
}

export function fonteDoBanco(cliente: () => Promise<ClienteDeLeitura>): FonteDePlacas {
  return {
    async consultar(consulta): Promise<PaginaDePlacas> {
      const c = await cliente();
      const base = filtros(consulta);
      const [pagina, chips] = await Promise.all([
        chamar<{
          linhas: LinhaDoBanco[];
          total: number;
          pagina: number;
          paginas: number;
          tam: number;
        }>(c, "listar_placas", {
          ...base,
          p_ordem: consulta.ordem.campo,
          p_decrescente: consulta.ordem.sentido === "desc",
          p_pagina: consulta.pagina,
          p_tam: consulta.tam,
        }),
        chamar<{ chip: string; quantidade: number }[]>(c, "contar_chips_de_placas", base),
      ]);
      const contagens: Record<string, number> = {};
      for (const id of [...STATUS, ...TIPOS_DE_ATIVO]) contagens[id] = 0;
      for (const { chip, quantidade } of chips ?? []) contagens[chip] = Number(quantidade);
      return {
        linhas: pagina.linhas.map(paraLinha),
        total: pagina.total,
        pagina: pagina.pagina,
        paginas: pagina.paginas,
        tam: pagina.tam,
        contagens,
      };
    },
    async obter(placa): Promise<DetalheDaPlaca | null> {
      const d = await chamar<DetalheDoBanco | null>(await cliente(), "detalhe_da_placa", {
        p_placa: placa,
      });
      return d ? paraDetalhe(d) : null;
    },
    async obterFicha(placa): Promise<FichaDaPlaca | null> {
      const c = await cliente();
      const d = await chamar<DetalheDoBanco | null>(c, "detalhe_da_placa", { p_placa: placa });
      if (!d) return null;
      const historia = await chamar<{ sigla: string; em: string }[]>(c, "historia_da_placa", {
        p_placa: placa,
      });
      return {
        ...paraDetalhe(d),
        eventos: (historia ?? []).map((e) => ({ sigla: sigla(e.sigla), em: e.em })),
      };
    },
  };
}
