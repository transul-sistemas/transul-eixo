import {
  podeDisponibilizar,
  podeReceberPedido,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import type {
  EntradaCadastrarPlaca,
  EntradaDisponibilizacao,
  EntradaRecebimento,
} from "@/lib/dominio/esquemas/placa";
import type { EventoDeStatus } from "@/lib/dominio/linha-do-tempo";
import { normalizarPlaca } from "@/lib/dominio/placa";
import type { Sigla } from "@/lib/dominio/status";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { CRS, FILIAIS, GESTORES, OPERACOES } from "./catalogos";
import { eventosDeExemplo } from "./eventos";
import { placasDeExemplo } from "./placas";
import type { PlacaDeExemplo, TipoDeAtivo } from "./tipos";

// Escrita de exemplo, em memória, sem banco: cadastrar, disponibilizar ao Operacional e receber placa
// (transferência entre gestores). Tem as mesmas regras que a gravação no banco terá: chave de envio
// (clique duplo e nova tentativa gravam uma vez), versão por registro (edição concorrente), placa única
// em qualquer formato, e evento com hora a cada mudança de situação. O estado vive na memória do
// processo (some ao reiniciar). Nunca é importado fora de desenvolvimento e testes (ver
// lib/qualidade/barramento-do-exemplo.ts); a Server Action chega aqui por lib/dados/fonte-de-exemplo.ts.

export interface VigenciaDeGestor {
  gestorId: string;
  gestor: string;
  /** `aaaa-mm-ddThh:mm`; o intervalo é `[inicio, fim)`. */
  inicio: string;
  fim: string | null;
}

/** A placa como o armazém a guarda: o que a tela mostra mais a versão e o histórico de gestores. */
export interface PlacaGravada {
  placa: string;
  tipo: TipoDeAtivo;
  renavam: string;
  marca: string | null;
  modelo: string;
  ano: number | null;
  sigla: Sigla;
  /** Desde quando está nesta situação, `aaaa-mm-ddThh:mm`. */
  desde: string;
  gestorId: string | null;
  gestor: string;
  operacaoId: string | null;
  operacao: string | null;
  crId: string | null;
  filialId: string | null;
  filial: string;
  motoristaId: string | null;
  metaCentavos: number | null;
  conjunto: { cavaloId: string | null; implementoIds: string[] };
  /** Sobe a cada mudança (edição concorrente). */
  versao: number;
  gestores: VigenciaDeGestor[];
}

type Atual = PlacaGravada | PedidoDeTransferencia;
type Resultado<T> = ResultadoDaAcao<T, Atual>;

export interface Armazem {
  cadastrar(entrada: EntradaCadastrarPlaca, chave: string, agora: string): Resultado<PlacaGravada>;
  disponibilizar(
    entrada: EntradaDisponibilizacao,
    chave: string,
    agora: string,
  ): Resultado<PlacaGravada>;
  receber(
    entrada: EntradaRecebimento,
    chave: string,
    agora: string,
    gestorId: string,
  ): Resultado<PlacaGravada>;
  obterPlaca(placa: string): PlacaGravada | null;
  eventosDaPlaca(placa: string): EventoDeStatus[];
  /** O pedido de transferência pendente da placa, se houver (é o que liga a ação "Receber placa"). */
  pedidoPendenteDa(placa: string): PedidoDeTransferencia | null;
  placasCadastradas(): PlacaGravada[];
}

function daBase(p: PlacaDeExemplo): PlacaGravada {
  const gestor = GESTORES.find((g) => g.nome === p.gestor);
  const operacao = OPERACOES.find((o) => o.nome === p.operacao);
  const filial = FILIAIS.find((f) => f.nome === p.filial);
  return {
    placa: p.placa,
    tipo: p.tipo,
    renavam: p.renavam,
    marca: null,
    modelo: p.modelo,
    ano: p.ano,
    sigla: p.sigla,
    desde: p.desde,
    gestorId: gestor?.id ?? null,
    gestor: p.gestor,
    operacaoId: operacao?.id ?? null,
    operacao: p.operacao,
    crId: p.crs.length > 0 ? (CRS.find((c) => c.operacaoId === operacao?.id)?.id ?? null) : null,
    filialId: filial?.id ?? null,
    filial: p.filial,
    motoristaId: null,
    metaCentavos: null,
    conjunto: { cavaloId: p.conjunto.cavaloId, implementoIds: [...p.conjunto.implementoIds] },
    versao: 1,
    gestores: [
      { gestorId: gestor?.id ?? "", gestor: p.gestor, inicio: p.desde.slice(0, 16), fim: null },
    ],
  };
}

export function criarArmazem({
  placasBase,
  pedidosBase = [],
}: {
  placasBase: readonly PlacaDeExemplo[];
  pedidosBase?: readonly PedidoDeTransferencia[];
}): Armazem {
  const base = new Map(placasBase.map((p) => [p.placa, p]));
  /** Placas mudadas ou cadastradas aqui (a base só é copiada na primeira mudança). */
  const gravadas = new Map<string, PlacaGravada>();
  const cadastradas: string[] = [];
  const eventos = new Map<string, EventoDeStatus[]>();
  const pedidos = new Map(pedidosBase.map((p) => [p.id, { ...p }]));
  /** Resultado de cada envio que deu certo, por ação e chave: o mesmo envio de novo devolve o mesmo. */
  const enviados = new Map<string, Resultado<PlacaGravada>>();

  const obterPlaca = (placa: string): PlacaGravada | null => {
    const gravada = gravadas.get(placa);
    if (gravada) return gravada;
    const deBase = base.get(placa);
    return deBase ? daBase(deBase) : null;
  };
  const eventosDaPlaca = (placa: string): EventoDeStatus[] => {
    const novos = eventos.get(placa);
    if (novos) return novos;
    const deBase = base.get(placa);
    return deBase ? eventosDeExemplo(deBase) : [];
  };
  const registrar = (placa: string, sigla: Sigla, em: string) => {
    eventos.set(placa, [...eventosDaPlaca(placa), { sigla, em }]);
  };
  const guardar = (placa: PlacaGravada) => void gravadas.set(placa.placa, placa);

  /** Roda a ação uma vez por chave; só o que deu certo fica guardado (falha não gasta a chave). */
  function unica(
    acao: string,
    chave: string,
    executar: () => Resultado<PlacaGravada>,
  ): Resultado<PlacaGravada> {
    const id = `${acao}:${chave}`;
    const anterior = enviados.get(id);
    if (anterior) return anterior;
    const resultado = executar();
    if (resultado.ok) enviados.set(id, resultado);
    return resultado;
  }

  const emConflito = (atual: Atual) =>
    erroDaAcao<Atual>("conflito", { atual }) as ReturnType<typeof erroDaAcao<Atual>>;

  return {
    obterPlaca,
    eventosDaPlaca,
    placasCadastradas: () => cadastradas.map((p) => gravadas.get(p) as PlacaGravada),
    pedidoPendenteDa(placa) {
      const pedido = [...pedidos.values()].find(
        (p) => p.placa === placa && p.situacao === "pendente",
      );
      return pedido ?? null;
    },

    cadastrar(entrada, chave, agora) {
      return unica("cadastrar", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const existente = obterPlaca(placa);
        if (existente) return erroDaAcao<Atual>("placa_ja_existe", { atual: existente });
        const campos: Record<string, string[]> = {};
        const gestor = GESTORES.find((g) => g.id === entrada.gestorId);
        if (!gestor) campos.gestorId = ["Este gestor não existe. Escolha um da lista."];
        const operacao = entrada.operacaoId
          ? OPERACOES.find((o) => o.id === entrada.operacaoId)
          : undefined;
        if (entrada.operacaoId && !operacao) {
          campos.operacaoId = ["Esta operação não existe. Escolha uma da lista."];
        }
        const cr = entrada.crId ? CRS.find((c) => c.id === entrada.crId) : undefined;
        if (entrada.crId && !cr) campos.crId = ["Este CR não existe. Escolha um da lista."];
        else if (cr && operacao && cr.operacaoId !== operacao.id) {
          campos.crId = ["Este CR não é da operação escolhida. Escolha o CR dela."];
        }
        if (Object.keys(campos).length > 0)
          return erroDaAcao<Atual>("entrada_invalida", { campos });

        const nova: PlacaGravada = {
          placa,
          tipo: entrada.tipo,
          renavam: entrada.renavam,
          marca: entrada.marca,
          modelo: entrada.modelo,
          ano: entrada.ano,
          sigla: entrada.situacaoInicial,
          desde: agora,
          gestorId: gestor!.id,
          gestor: gestor!.nome,
          operacaoId: operacao?.id ?? null,
          operacao: operacao?.nome ?? null,
          crId: cr?.id ?? null,
          filialId: null,
          filial: "—",
          motoristaId: null,
          metaCentavos: null,
          conjunto: { cavaloId: null, implementoIds: [] },
          versao: 1,
          gestores: [{ gestorId: gestor!.id, gestor: gestor!.nome, inicio: agora, fim: null }],
        };
        guardar(nova);
        cadastradas.push(placa);
        registrar(placa, nova.sigla, agora);
        return sucesso(nova);
      });
    },

    disponibilizar(entrada, chave, agora) {
      return unica("disponibilizar", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        if (atual.versao !== entrada.versaoEsperada) return emConflito(atual);
        if (!podeDisponibilizar(atual.sigla)) {
          return erroDaAcao<Atual>("entrada_invalida", {
            campos: { placa: ["Só dá para disponibilizar placa em PÁT, VAz ou ETv."] },
          });
        }
        const filial = FILIAIS.find((f) => f.id === entrada.filialId);
        if (!filial) {
          return erroDaAcao<Atual>("entrada_invalida", {
            campos: { filialId: ["Esta filial não existe. Escolha uma da lista."] },
          });
        }
        const nova: PlacaGravada = {
          ...atual,
          sigla: "DOp",
          desde: agora,
          filialId: filial.id,
          filial: filial.nome,
          versao: atual.versao + 1,
        };
        guardar(nova);
        registrar(placa, "DOp", agora);
        return sucesso(nova);
      });
    },

    receber(entrada, chave, agora, gestorId) {
      return unica("receber", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const pedido = pedidos.get(entrada.pedidoId);
        if (!pedido) return erroDaAcao<Atual>("nao_encontrado");
        if (pedido.placa !== placa) {
          return erroDaAcao<Atual>("entrada_invalida", {
            campos: { placa: ["Este pedido de transferência é de outra placa."] },
          });
        }
        if (pedido.situacao !== "pendente" || pedido.versao !== entrada.versaoEsperada) {
          return emConflito(pedido);
        }
        const pode = podeReceberPedido(pedido, gestorId);
        if (!pode.ok) return erroDaAcao<Atual>("sem_permissao");
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        const destino = GESTORES.find((g) => g.id === pedido.paraGestorId);
        const operacao = entrada.operacaoId
          ? OPERACOES.find((o) => o.id === entrada.operacaoId)
          : undefined;
        const cr = entrada.crId ? CRS.find((c) => c.id === entrada.crId) : undefined;
        const campos: Record<string, string[]> = {};
        if (entrada.operacaoId && !operacao) campos.operacaoId = ["Esta operação não existe."];
        if (entrada.crId && !cr) campos.crId = ["Este CR não existe."];
        else if (cr && operacao && cr.operacaoId !== operacao.id) {
          campos.crId = ["Este CR não é da operação escolhida."];
        }
        if (!destino) campos.placa = ["O gestor de destino do pedido não existe mais."];
        if (Object.keys(campos).length > 0)
          return erroDaAcao<Atual>("entrada_invalida", { campos });

        const fechadas = atual.gestores.map((v, i, todas) =>
          i === todas.length - 1 ? { ...v, fim: agora } : v,
        );
        const nova: PlacaGravada = {
          ...atual,
          sigla: entrada.situacao,
          desde: agora,
          gestorId: destino!.id,
          gestor: destino!.nome,
          operacaoId: operacao?.id ?? null,
          operacao: operacao?.nome ?? null,
          crId: cr?.id ?? null,
          motoristaId: entrada.motoristaId,
          metaCentavos: entrada.metaCentavos,
          conjunto: {
            cavaloId: entrada.conjunto.cavaloId,
            implementoIds: [...entrada.conjunto.implementoIds],
          },
          versao: atual.versao + 1,
          gestores: [
            ...fechadas,
            { gestorId: destino!.id, gestor: destino!.nome, inicio: agora, fim: null },
          ],
        };
        guardar(nova);
        pedidos.set(pedido.id, { ...pedido, situacao: "concluido", versao: pedido.versao + 1 });
        registrar(placa, nova.sigla, agora);
        return sucesso(nova);
      });
    },
  };
}

const CHAVE_DO_PROCESSO = Symbol.for("eixo.armazem-de-exemplo");

/**
 * O armazém do processo: um só, que sobrevive ao recarregar de módulo em desenvolvimento (`globalThis`).
 * Nasce das placas de exemplo de `hoje` e de um pedido de transferência de exemplo.
 */
export function armazemDoProcesso(hoje: string): Armazem {
  const global = globalThis as unknown as Record<symbol, Armazem | undefined>;
  const existente = global[CHAVE_DO_PROCESSO];
  if (existente) return existente;
  const placasBase = placasDeExemplo(hoje);
  const comPedido = placasBase.find(
    (p) => p.gestor === GESTORES[0]?.nome && p.sigla !== "VND" && p.sigla !== "SUC",
  );
  const criado = criarArmazem({
    placasBase,
    pedidosBase: comPedido
      ? [
          {
            id: "ped-exemplo-1",
            placa: comPedido.placa,
            deGestorId: GESTORES[0]!.id,
            paraGestorId: GESTORES[1]!.id,
            motivo: "Troca de carteira entre filiais",
            pendenciasConhecidas: [{ id: "pend-1", texto: "CRLV vence em breve" }],
            situacao: "pendente",
            versao: 1,
          },
        ]
      : [],
  });
  global[CHAVE_DO_PROCESSO] = criado;
  return criado;
}
