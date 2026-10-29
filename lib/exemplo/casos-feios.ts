import type { CodigoDeAlerta } from "@/lib/dominio/alertas";
import { somarDias } from "./datas";
import type { PlacaDeExemplo } from "./tipos";

// Casos feios, de propósito: os que a lista de saneamento da v1 já mostrou. Cada um muda uma placa
// que o gerador criou "limpa", para a tela ser testada com dado ruim.

export interface CasoFeio {
  descricao: string;
  /** O alerta que a regra de domínio deve levantar para este caso (se houver). */
  alerta?: CodigoDeAlerta;
  ajustar: (placa: PlacaDeExemplo, hoje: string) => PlacaDeExemplo;
}

const CR_A = { codigo: "CR-1001", nome: "Operação Exemplo 1" };
const CR_B = { codigo: "CR-1002", nome: "Operação Exemplo 2" };

export const CASOS_FEIOS: Record<string, CasoFeio> = {
  AAA0A03: {
    descricao: 'Modelo "A DEFINIR"',
    alerta: "modelo-a-definir",
    ajustar: (p) => ({ ...p, modelo: "A DEFINIR", sigla: "DOp" }),
  },
  AAA0A05: {
    descricao: "Cavalo com dois CRs vigentes ao mesmo tempo",
    alerta: "cr-sobreposto",
    ajustar: (p, hoje) => ({
      ...p,
      operacao: CR_A.nome,
      crs: [
        { ...CR_A, inicio: somarDias(hoje, -200), fim: null },
        { ...CR_B, inicio: somarDias(hoje, -30), fim: null },
      ],
    }),
  },
  AAA0A06: {
    descricao: "Cavalo com dois CRs em sequência (histórico, sem sobreposição)",
    ajustar: (p, hoje) => ({
      ...p,
      operacao: CR_B.nome,
      crs: [
        { ...CR_A, inicio: somarDias(hoje, -400), fim: somarDias(hoje, -120) },
        { ...CR_B, inicio: somarDias(hoje, -120), fim: null },
      ],
    }),
  },
  AAA0A07: {
    descricao: "Cavalo que troca de CR hoje: um termina e o outro começa no mesmo dia",
    ajustar: (p, hoje) => ({
      ...p,
      operacao: CR_B.nome,
      crs: [
        { ...CR_A, inicio: somarDias(hoje, -300), fim: hoje },
        { ...CR_B, inicio: hoje, fim: null },
      ],
    }),
  },
  AAA0A08: {
    descricao: "Cavalo em trânsito carregado sem motorista",
    alerta: "sem-motorista",
    ajustar: (p) => ({ ...p, sigla: "ETc", motorista: null }),
  },
  AAA0A10: {
    descricao: "Documento (CRLV) vencido há 75 dias",
    alerta: "crlv-vencido",
    ajustar: (p, hoje) => ({ ...p, crlvVenceEm: somarDias(hoje, -75) }),
  },
  AAA0A12: {
    descricao: "Cavalo sem operação, sem CR e sem CRLV",
    ajustar: (p) => ({ ...p, operacao: null, crs: [], crlvVenceEm: null }),
  },
  AAA0B50: {
    descricao: "Implemento solto no pátio há 35 dias, sem cavalo",
    alerta: "implemento-solto",
    ajustar: (p, hoje) => ({
      ...p,
      sigla: "PÁT",
      desde: `${somarDias(hoje, -35)}T08:00`,
      conjunto: { cavaloId: null, implementoIds: [] },
    }),
  },
};
