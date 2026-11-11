import { falhaDeLeitura } from "@/lib/erros/leitura";
import type { EstadoDoAbastecimento } from "@/lib/navegacao/abastecimento";
import type { AbastecimentoDoMes } from "./abastecimento-tipos";
import type { TipoDeAtivo } from "./placas-tipos";

export type {
  AbastecimentoDoMes,
  LinhaDoAbastecimento,
  TotaisDoAbastecimento,
} from "./abastecimento-tipos";

// A leitura de Frota › Abastecimento: só o banco, com a sessão de quem usa (a RLS decide o que cada
// perfil vê). Quem filtra, pagina, ordena e soma é nucleo.abastecimento_do_mes, sobre o staging
// provisório da v1 (até a ponte do Sankhya); aqui só se converte o formato.

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDoAbastecimento {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDoAbastecimento> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDoAbastecimento;
}

interface LinhaDoBanco {
  placa: string;
  ativo_id: string | null;
  tipo: TipoDeAtivo | null;
  modelo: string | null;
  abastecimentos: number;
  litros: number;
  km: number;
  km_por_litro: number | null;
  valor: number | null;
  sem_hodometro: number;
}

interface RespostaDoBanco {
  mes: string;
  meses: string[];
  linhas: LinhaDoBanco[];
  totais: {
    placas: number;
    abastecimentos: number;
    litros: number;
    km: number;
    km_por_litro: number | null;
    valor: number;
    sem_hodometro: number;
  };
  filtradas: number;
  pagina: number;
  paginas: number;
  tam: number;
}

const centavos = (reais: number | null): number | null =>
  reais === null ? null : Math.round(Number(reais) * 100);
const mesDe = (data: string) => data.slice(0, 7);

export async function lerAbastecimentoDoMes(
  estado: EstadoDoAbastecimento,
  cliente: () => Promise<ClienteDoAbastecimento> = clienteDaSessao,
): Promise<AbastecimentoDoMes> {
  const c = await cliente();
  const { consulta } = estado;
  const { data, error } = await c.schema("nucleo").rpc("abastecimento_do_mes", {
    p_mes: estado.mes ? `${estado.mes}-01` : null,
    p_busca: consulta.busca === "" ? null : consulta.busca,
    p_ordem: `${consulta.ordem.sentido === "desc" ? "-" : ""}${consulta.ordem.campo}`,
    p_pagina: consulta.pagina,
    p_tam: consulta.tam,
  });
  if (error) throw falhaDeLeitura("abastecimento_do_mes", error);
  const d = data as RespostaDoBanco;
  return {
    mes: mesDe(d.mes),
    meses: d.meses.map(mesDe),
    linhas: d.linhas.map((l) => ({
      placa: l.placa,
      ativoId: l.ativo_id,
      tipo: l.tipo,
      modelo: l.modelo,
      abastecimentos: l.abastecimentos,
      litros: Number(l.litros),
      km: Number(l.km),
      kmPorLitro: l.km_por_litro === null ? null : Number(l.km_por_litro),
      valorCentavos: centavos(l.valor),
      semHodometro: l.sem_hodometro,
    })),
    totais: {
      placas: d.totais.placas,
      abastecimentos: d.totais.abastecimentos,
      litros: Number(d.totais.litros),
      km: Number(d.totais.km),
      kmPorLitro: d.totais.km_por_litro === null ? null : Number(d.totais.km_por_litro),
      valorCentavos: centavos(d.totais.valor) ?? 0,
      semHodometro: d.totais.sem_hodometro,
    },
    filtradas: d.filtradas,
    pagina: d.pagina,
    paginas: d.paginas,
    tam: d.tam,
  };
}
