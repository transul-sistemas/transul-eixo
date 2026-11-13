import { MENSAGENS_PADRAO, type ResultadoDaAcao } from "@/lib/wizard/resultado";
import type { PedidoDeTransferencia } from "./custodia";
import { vigenteEm } from "./vigencia";

// Meu dia › Receber placas em lote. Regras puras: não há regra nova de transferência. O lote só
// orquestra as funções atômicas que já existem (receber, concluir recebimento e devolver), uma
// placa de cada vez, cada uma na sua transação, e conta o resultado ("X de Y").

export type Decisao = "aceitar" | "aceitar_com_pendencias" | "recusar";
export type Etapa = "receber" | "concluir" | "devolver" | "registrar_sem_cr";

export const MOTIVO_MAXIMO = 300;
/** A nota que cada pendência leva quando o gestor aceita a placa com pendências (a função exige uma). */
export const NOTA_DA_PENDENCIA = "Pendência registrada ao receber a placa pelo Meu dia.";

export const ROTULO_DA_DECISAO: Record<Decisao, string> = {
  aceitar: "Aceitar",
  aceitar_com_pendencias: "Com pendências",
  recusar: "Recusar",
};

/** Um pedido que espera o gestor, com o CR vigente de hoje e a operação da placa. */
export interface LinhaDoPedido {
  pedido: PedidoDeTransferencia;
  /** Os CRs vigentes hoje (pode haver mais de um); `[]` = sem CR vigente; `null` = não foi possível ler. */
  crs: { codigo: string; nome: string }[] | null;
  operacao: string | null;
  /** Quando o pedido foi enviado (instante UTC); nulo se a leitura não trouxe. */
  enviadaEm?: string | null;
  /** O prazo da transferência em dias (config.parametro); nulo se a leitura não trouxe. */
  prazoDias?: number | null;
}

export interface ItemDoLote {
  pedido: PedidoDeTransferencia;
  decisao: Decisao | null;
  motivo: string;
  /** Os CRs vigentes hoje da placa (`[]` = sem CR; `null` = não lido; ausente = não conferir). */
  crs?: { codigo: string; nome: string }[] | null;
}

/** Só o gestor de destino decide o lote; o Administrador vê a fila e os dados, em modo leitura. */
export function podeDecidirNoLote(perfil: string): boolean {
  return perfil === "Gestor de frota";
}

/**
 * Aceitar (limpo ou com pendências) uma placa sem CR vigente abre a exceção "placa sem CR". CR não lido
 * (`null`) também chama: o banco confere por dentro, e a função é idempotente.
 */
export function precisaRegistrarSemCr(
  decisao: Decisao,
  crs: readonly { codigo: string }[] | null,
): boolean {
  return decisao !== "recusar" && (crs === null || crs.length === 0);
}

/** Dias de calendário (dia de São Paulo, -03:00) entre o envio, em UTC, e hoje (`aaaa-mm-dd`); nunca negativo. */
export function diasDesdeOEnvio(enviadaEm: string, hoje: string): number {
  const envioLocal = new Date(new Date(enviadaEm).getTime() - 3 * 3600_000)
    .toISOString()
    .slice(0, 10);
  const dia = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return Math.max(0, Math.round((dia(hoje) - dia(envioLocal)) / 86_400_000));
}

export interface SituacaoDoEnvio {
  /** "há 8 dias", "há 1 dia" ou "hoje"; nulo sem data de envio. */
  rotulo: string | null;
  /** Passou do prazo da transferência (no dia limite ainda está no prazo). Sinaliza; nunca cancela. */
  vencido: boolean;
  /** O texto que acompanha o vermelho suave, para a cor nunca ficar sozinha. */
  aviso: string | null;
}

export function situacaoDoEnvio(
  enviadaEm: string | null,
  hoje: string,
  prazoDias: number | null,
): SituacaoDoEnvio {
  if (enviadaEm === null) return { rotulo: null, vencido: false, aviso: null };
  const dias = diasDesdeOEnvio(enviadaEm, hoje);
  const rotulo = dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;
  const vencido = prazoDias !== null && dias > prazoDias;
  return { rotulo, vencido, aviso: vencido ? "Prazo vencido" : null };
}

/**
 * O que se pode decidir sobre o pedido. Aceitar limpo só vale sem pendências conhecidas (aceitar uma
 * placa que chegou com pendência é "Com pendências"); recusar vale sempre que o pedido está aberto.
 */
export function decisoesPermitidas(pedido: PedidoDeTransferencia): Decisao[] {
  if (pedido.situacao !== "pendente" && pedido.situacao !== "em_conferencia") return [];
  return pedido.pendenciasConhecidas.length === 0
    ? ["aceitar", "recusar"]
    : ["aceitar_com_pendencias", "recusar"];
}

/** As funções que a decisão chama, na ordem: a chegada (se ainda pendente) e depois concluir ou devolver. */
export function etapasDaDecisao(
  pedido: PedidoDeTransferencia,
  decisao: Decisao,
  crs?: readonly { codigo: string }[] | null,
): Etapa[] {
  const ultima: Etapa = decisao === "recusar" ? "devolver" : "concluir";
  const etapas: Etapa[] = pedido.situacao === "pendente" ? ["receber", ultima] : [ultima];
  if (crs !== undefined && precisaRegistrarSemCr(decisao, crs)) etapas.push("registrar_sem_cr");
  return etapas;
}

export interface ProblemaDoLote {
  pedidoId: string;
  mensagem: string;
}

export function problemasDoLote(itens: readonly ItemDoLote[]): ProblemaDoLote[] {
  if (itens.length === 0) {
    return [{ pedidoId: "", mensagem: "Nenhuma placa para decidir." }];
  }
  const problemas: ProblemaDoLote[] = [];
  for (const { pedido, decisao, motivo } of itens) {
    if (decisao === null) {
      problemas.push({
        pedidoId: pedido.id,
        mensagem: `Escolha o que fazer com a placa ${pedido.placa}.`,
      });
    } else if (!decisoesPermitidas(pedido).includes(decisao)) {
      problemas.push({
        pedidoId: pedido.id,
        mensagem: `A placa ${pedido.placa} não aceita esta decisão: escolha outra.`,
      });
    } else if (decisao === "recusar") {
      const texto = motivo.trim();
      if (texto === "") {
        problemas.push({
          pedidoId: pedido.id,
          mensagem: `Informe o motivo da recusa da placa ${pedido.placa}.`,
        });
      } else if (texto.length > MOTIVO_MAXIMO) {
        problemas.push({
          pedidoId: pedido.id,
          mensagem: `Use até ${MOTIVO_MAXIMO} caracteres no motivo da placa ${pedido.placa}.`,
        });
      }
    }
  }
  return problemas;
}

/** Os CRs vigentes no dia (a placa pode ter mais de um ao mesmo tempo); nenhum = lista vazia, nunca um CR inventado. */
export function crsVigentesEm<T extends { inicio: string; fim: string | null }>(
  crs: readonly T[],
  dia: string,
): T[] {
  return crs.filter((cr) => vigenteEm([cr], dia) !== null);
}

// ---------- a execução do lote ----------

type Chamada<E, R> = (entrada: E, chaveDeEnvio: string) => Promise<ResultadoDaAcao<R>>;
interface Base {
  placa: string;
  pedidoId: string;
  versaoDoPedido: number;
}

export interface ChamadasDoLote {
  receber: Chamada<Base & { conferido: true }, PedidoDeTransferencia>;
  concluir: Chamada<
    Base & { pendencias: { id: string; resolvida: boolean; nota: string }[] },
    unknown
  >;
  devolver: Chamada<Base & { motivo: string }, unknown>;
  /** Abre a exceção "placa sem CR" (o banco confere por dentro e é idempotente). */
  registrarSemCr?: Chamada<{ pedidoId: string }, unknown>;
}

/** O que já foi gravado de cada pedido, para repetir sem duplicar e retomar de onde parou. */
export interface ProgressoDoPedido {
  versao: number;
  feitas: Etapa[];
  chaves: Partial<Record<Etapa, string>>;
  concluido: boolean;
}
export type ProgressoDoLote = Map<string, ProgressoDoPedido>;

export interface ResultadoDaPlaca {
  pedidoId: string;
  placa: string;
  decisao: Decisao;
  situacao: "feita" | "falhou";
  erro?: string;
}

export async function executarLote(
  itens: readonly ItemDoLote[],
  chamadas: ChamadasDoLote,
  progresso: ProgressoDoLote,
  novaChave: () => string,
): Promise<ResultadoDaPlaca[]> {
  const resultados: ResultadoDaPlaca[] = [];
  for (const { pedido, decisao, motivo, crs } of itens) {
    if (decisao === null) continue;
    const base = { pedidoId: pedido.id, placa: pedido.placa, decisao };
    const p = progresso.get(pedido.id) ?? {
      versao: pedido.versao,
      feitas: [],
      chaves: {},
      concluido: false,
    };
    progresso.set(pedido.id, p);
    if (p.concluido) {
      resultados.push({ ...base, situacao: "feita" });
      continue;
    }
    let falha: string | null = null;
    for (const etapa of etapasDaDecisao(
      pedido,
      decisao,
      chamadas.registrarSemCr ? crs : undefined,
    )) {
      if (p.feitas.includes(etapa)) continue;
      const chave = (p.chaves[etapa] ??= novaChave());
      const comum = { placa: pedido.placa, pedidoId: pedido.id, versaoDoPedido: p.versao };
      try {
        let r: ResultadoDaAcao<unknown>;
        if (etapa === "receber") {
          const recebido = await chamadas.receber({ ...comum, conferido: true }, chave);
          if (recebido.ok) p.versao = recebido.linha.versao;
          r = recebido;
        } else if (etapa === "concluir") {
          r = await chamadas.concluir(
            {
              ...comum,
              pendencias: pedido.pendenciasConhecidas.map(({ id }) => ({
                id,
                resolvida: decisao !== "aceitar_com_pendencias",
                nota: NOTA_DA_PENDENCIA,
              })),
            },
            chave,
          );
        } else if (etapa === "registrar_sem_cr") {
          r = await (chamadas.registrarSemCr as NonNullable<ChamadasDoLote["registrarSemCr"]>)(
            { pedidoId: pedido.id },
            chave,
          );
        } else {
          r = await chamadas.devolver({ ...comum, motivo: motivo.trim() }, chave);
        }
        if (!r.ok) {
          falha = r.erro.mensagem;
          break;
        }
        p.feitas.push(etapa);
      } catch {
        falha = MENSAGENS_PADRAO.falha;
        break;
      }
    }
    if (falha === null) {
      p.concluido = true;
      resultados.push({ ...base, situacao: "feita" });
    } else {
      resultados.push({ ...base, situacao: "falhou", erro: falha });
    }
  }
  return resultados;
}

export interface ResumoDoLote {
  total: number;
  feitas: number;
  falhas: number;
  aceitas: number;
  comPendencias: number;
  recusadas: number;
  texto: string;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function resumoDoLote(resultados: readonly ResultadoDaPlaca[]): ResumoDoLote {
  const feitas = resultados.filter((r) => r.situacao === "feita");
  const contar = (d: Decisao) => feitas.filter((r) => r.decisao === d).length;
  const aceitas = contar("aceitar");
  const comPendencias = contar("aceitar_com_pendencias");
  const recusadas = contar("recusar");
  const falhas = resultados.length - feitas.length;
  const partes = [
    aceitas > 0 ? plural(aceitas, "aceita", "aceitas") : null,
    comPendencias > 0 ? `${comPendencias} com pendências` : null,
    recusadas > 0 ? plural(recusadas, "recusada", "recusadas") : null,
  ].filter((x): x is string => x !== null);
  let texto = `${feitas.length} de ${resultados.length} ${resultados.length === 1 ? "decisão gravada" : "decisões gravadas"}`;
  if (partes.length > 0) texto += `: ${partes.join(", ")}`;
  texto += ".";
  if (falhas > 0) texto += ` ${plural(falhas, "não foi gravada", "não foram gravadas")}.`;
  return {
    total: resultados.length,
    feitas: feitas.length,
    falhas,
    aceitas,
    comPendencias,
    recusadas,
    texto,
  };
}
