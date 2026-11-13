import { TAM_PADRAO_DA_LISTA } from "./operacional";
import { TAMANHOS_DE_PAGINA } from "./preferencias-da-tabela";

// O estado das telas de painel na URL (?mes=&filtro=&busca=&pagina=&tam=): recarregar ou compartilhar o
// link devolve a mesma visão. Valor desconhecido volta ao padrão; mudar mês, filtro ou busca volta à
// página 1 (quem monta o endereço decide).

export interface EstadoDoPainel {
  /** `aaaa-mm`, ou nulo para o mês padrão da fonte. */
  mes: string | null;
  /** O chip escolhido, ou nulo para "todos". */
  filtro: string | null;
  busca: string;
  pagina: number;
  tam: number;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const FILTRO = /^[a-z0-9_-]{1,40}$/i;

export function lerEstadoDoPainel(
  parametros: URLSearchParams,
  tamLembrado: number = TAM_PADRAO_DA_LISTA,
): EstadoDoPainel {
  const mes = parametros.get("mes");
  const filtro = parametros.get("filtro");
  const pagina = Number(parametros.get("pagina"));
  const tam = Number(parametros.get("tam"));
  return {
    mes: mes && MES.test(mes) ? mes : null,
    filtro: filtro && FILTRO.test(filtro) ? filtro : null,
    busca: (parametros.get("busca") ?? "").trim().slice(0, 60),
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
    tam: (TAMANHOS_DE_PAGINA as readonly number[]).includes(tam) ? tam : tamLembrado,
  };
}

/** O endereço da visão; só leva o que difere do padrão. */
export function enderecoDoPainel(rota: string, estado: EstadoDoPainel): string {
  const p = new URLSearchParams();
  if (estado.mes) p.set("mes", estado.mes);
  if (estado.filtro) p.set("filtro", estado.filtro);
  if (estado.busca) p.set("busca", estado.busca);
  if (estado.pagina > 1) p.set("pagina", String(estado.pagina));
  if (estado.tam !== TAM_PADRAO_DA_LISTA) p.set("tam", String(estado.tam));
  const texto = p.toString();
  return texto ? `${rota}?${texto}` : rota;
}
