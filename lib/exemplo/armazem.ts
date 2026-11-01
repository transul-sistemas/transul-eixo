import {
  motivoDeNaoDisponibilizar,
  podeReceberPedido,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import type {
  EntradaCadastrarPlaca,
  EntradaDisponibilizacao,
  EntradaItemDeCatalogo,
  EntradaRecebimento,
  TipoDeItemDeCatalogo,
} from "@/lib/dominio/esquemas/placa";
import { carroceriaDoModelo } from "@/lib/dominio/conjunto";
import type { EventoDeStatus } from "@/lib/dominio/linha-do-tempo";
import { normalizarPlaca } from "@/lib/dominio/placa";
import type { Sigla } from "@/lib/dominio/status";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import {
  CRS,
  FILIAIS,
  GARAGENS,
  GESTORES,
  MARCAS,
  MODELOS,
  MOTORISTAS,
  OPERACOES,
} from "./catalogos";
import type {
  CandidatoDoConjunto,
  Catalogos,
  ItemCriado,
  PlacaGravada,
  ValorDaPlaca,
} from "@/lib/dados/escrita-tipos";
import { eventosDeExemplo } from "./eventos";
import { placasDeExemplo } from "./placas";
import type { PlacaDeExemplo } from "./tipos";

export type {
  CandidatoDoConjunto,
  Catalogos,
  ItemCriado,
  PlacaGravada,
  ValorDaPlaca,
  VigenciaDeCr,
  VigenciaDeGestor,
} from "@/lib/dados/escrita-tipos";

// Escrita de exemplo, em memória, sem banco: cadastrar placa, disponibilizar ao Operacional, receber
// placa (transferência entre gestores) e criar itens de catálogo (o que o "+" cadastra). Tem as
// mesmas regras que a gravação no banco terá: chave de envio (clique duplo e nova tentativa gravam
// uma vez), versão por registro (edição concorrente), placa única em qualquer formato, filhos que
// pertencem ao pai escolhido (modelo da marca, CR da operação, garagem da filial) e evento com hora
// a cada mudança de situação. O estado vive na memória do processo (some ao reiniciar). Nunca é
// importado fora de desenvolvimento e testes (ver lib/qualidade/barramento-do-exemplo.ts); a Server
// Action chega aqui por lib/dados/fonte-de-exemplo.ts.

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
  criarItemDeCatalogo(entrada: EntradaItemDeCatalogo, chave: string): Resultado<ItemCriado>;
  catalogos(): Catalogos;
  obterPlaca(placa: string): PlacaGravada | null;
  eventosDaPlaca(placa: string): EventoDeStatus[];
  /** O pedido de transferência pendente da placa, se houver (é o que liga a ação "Receber placa"). */
  pedidoPendenteDa(placa: string): PedidoDeTransferencia | null;
  /** Todos os pedidos pendentes (o assistente sem placa escolhida lista as placas deles). */
  pedidosPendentes(): PedidoDeTransferencia[];
  placasCadastradas(): PlacaGravada[];
  /** As placas como a lista e a ficha as veem: as de base já com as mudanças, mais as cadastradas. */
  placasParaLista(): PlacaDeExemplo[];
  /** Quem pode entrar no conjunto da placa: implementos sem cavalo (para o cavalo), cavalos (para o implemento). */
  candidatosDoConjunto(placa: string): CandidatoDoConjunto[];
}

const simples = (texto: string) =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
const dia = (agora: string) => agora.slice(0, 10);

function daBase(p: PlacaDeExemplo, cat: Catalogos): PlacaGravada {
  const gestor = cat.gestores.find((g) => g.nome === p.gestor);
  const operacao = cat.operacoes.find((o) => o.nome === p.operacao);
  const filial = cat.filiais.find((f) => f.nome === p.filial);
  const modelo = cat.modelos.find((m) => m.nome === p.modelo);
  const marca = cat.marcas.find((m) => m.id === modelo?.marcaId);
  return {
    placa: p.placa,
    tipo: p.tipo,
    renavam: p.renavam,
    marcaId: marca?.id ?? null,
    marca: marca?.nome ?? null,
    modeloId: modelo?.id ?? null,
    modelo: p.modelo,
    ano: p.ano,
    sigla: p.sigla,
    desde: p.desde,
    gestorId: gestor?.id ?? null,
    gestor: p.gestor,
    operacaoId: operacao?.id ?? null,
    operacao: p.operacao,
    crId:
      p.crs.length > 0 ? (cat.crs.find((c) => c.operacaoId === operacao?.id)?.id ?? null) : null,
    crs: p.crs.map((c) => ({ ...c })),
    filialId: filial?.id ?? null,
    filial: p.filial,
    garagemId: null,
    garagem: "—",
    motoristaId: null,
    metaDoConjuntoCentavos: null,
    valor: {
      codigoFipe: null,
      valorFipeCentavos: p.valorFipeCentavos,
      valorManualCentavos: null,
      fonteDoValor: null,
      dataDoValor: null,
    },
    conjunto: { cavaloId: p.conjunto.cavaloId, implementoIds: [...p.conjunto.implementoIds] },
    versao: 1,
    gestores: [
      { gestorId: gestor?.id ?? "", gestor: p.gestor, inicio: p.desde.slice(0, 16), fim: null },
    ],
  };
}

function paraExemplo(
  g: PlacaGravada,
  base: PlacaDeExemplo | undefined,
  cat: Catalogos,
): PlacaDeExemplo {
  const motorista = g.motoristaId
    ? (cat.motoristas.find((m) => m.id === g.motoristaId)?.nome ?? null)
    : (base?.motorista ?? null);
  return {
    id: base?.id ?? `pl-${g.placa}`,
    placa: g.placa,
    renavam: g.renavam,
    tipo: g.tipo,
    modelo: g.modelo,
    ano: g.ano,
    sigla: g.sigla,
    desde: g.desde,
    filial: g.filial,
    operacao: g.operacao,
    crs: g.crs.map((c) => ({ ...c })),
    gestor: g.gestor,
    motorista,
    crlvVenceEm: base?.crlvVenceEm ?? null,
    km: base?.km ?? null,
    valorFipeCentavos: g.valor.valorFipeCentavos ?? base?.valorFipeCentavos ?? null,
    conjunto: { cavaloId: g.conjunto.cavaloId, implementoIds: [...g.conjunto.implementoIds] },
  };
}

function idDoItem(
  tipo: TipoDeItemDeCatalogo,
  nome: string,
  existentes: ReadonlySet<string>,
): string {
  const prefixo = tipo === "operacao" ? "op" : tipo;
  const corpo =
    tipo === "cr"
      ? nome.slice(3)
      : simples(nome)
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
  let id = `${prefixo}-${corpo}`;
  for (let n = 2; existentes.has(id); n++) id = `${prefixo}-${corpo}-${n}`;
  return id;
}

export function criarArmazem({
  placasBase,
  pedidosBase = [],
}: {
  placasBase: readonly PlacaDeExemplo[];
  pedidosBase?: readonly PedidoDeTransferencia[];
}): Armazem {
  const cat: Catalogos = {
    marcas: [...MARCAS],
    modelos: [...MODELOS],
    gestores: [...GESTORES],
    operacoes: [...OPERACOES],
    crs: [...CRS],
    filiais: [...FILIAIS],
    garagens: [...GARAGENS],
    motoristas: [...MOTORISTAS],
  };
  const base = new Map(placasBase.map((p) => [p.placa, p]));
  /** Placas mudadas ou cadastradas aqui (a base só é copiada na primeira mudança). */
  const gravadas = new Map<string, PlacaGravada>();
  const cadastradas: string[] = [];
  const eventos = new Map<string, EventoDeStatus[]>();
  const pedidos = new Map(pedidosBase.map((p) => [p.id, { ...p }]));
  /** Resultado de cada envio que deu certo, por ação e chave: o mesmo envio de novo devolve o mesmo. */
  const enviados = new Map<string, Resultado<unknown>>();

  const obterPlaca = (placa: string): PlacaGravada | null => {
    const gravada = gravadas.get(placa);
    if (gravada) return gravada;
    const deBase = base.get(placa);
    return deBase ? daBase(deBase, cat) : null;
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
  const placasParaLista = (): PlacaDeExemplo[] => [
    ...placasBase.map((p) => {
      const g = gravadas.get(p.placa);
      return g ? paraExemplo(g, p, cat) : p;
    }),
    ...cadastradas.map((placa) => paraExemplo(gravadas.get(placa) as PlacaGravada, undefined, cat)),
  ];

  /** Roda a ação uma vez por chave; só o que deu certo fica guardado (falha não gasta a chave). */
  function unica<T>(acao: string, chave: string, executar: () => Resultado<T>): Resultado<T> {
    const id = `${acao}:${chave}`;
    const anterior = enviados.get(id);
    if (anterior) return anterior as Resultado<T>;
    const resultado = executar();
    if (resultado.ok) enviados.set(id, resultado);
    return resultado;
  }

  const emConflito = <T>(atual: Atual) => erroDaAcao<Atual>("conflito", { atual }) as Resultado<T>;

  /** Confere gestor, operação, CR, marca, modelo, filial e garagem escolhidos; devolve os erros por campo. */
  function conferirReferencias(e: {
    gestorId: string;
    operacaoId: string | null;
    crId: string | null;
    marcaId?: string;
    modeloId?: string;
    filialId?: string;
    garagemId?: string;
  }) {
    const campos: Record<string, string[]> = {};
    const gestor = cat.gestores.find((g) => g.id === e.gestorId);
    if (!gestor) campos.gestorId = ["Este gestor não existe. Escolha um da lista."];
    const operacao = e.operacaoId ? cat.operacoes.find((o) => o.id === e.operacaoId) : undefined;
    if (e.operacaoId && !operacao) {
      campos.operacaoId = ["Esta operação não existe. Escolha uma da lista."];
    }
    const cr = e.crId ? cat.crs.find((c) => c.id === e.crId) : undefined;
    if (e.crId && !cr) campos.crId = ["Este CR não existe. Escolha um da lista."];
    else if (cr && operacao && cr.operacaoId !== operacao.id) {
      campos.crId = ["Este CR não é da operação escolhida. Escolha o CR dela."];
    }
    const marca = e.marcaId ? cat.marcas.find((m) => m.id === e.marcaId) : undefined;
    if (e.marcaId !== undefined && !marca) {
      campos.marcaId = ["Esta marca não existe. Escolha uma da lista."];
    }
    const modelo = e.modeloId ? cat.modelos.find((m) => m.id === e.modeloId) : undefined;
    if (e.modeloId !== undefined && !modelo) {
      campos.modeloId = ["Este modelo não existe. Escolha um da lista."];
    } else if (modelo && marca && modelo.marcaId !== marca.id) {
      campos.modeloId = ["Este modelo não é da marca escolhida. Escolha um modelo dela."];
    }
    const filial = e.filialId ? cat.filiais.find((f) => f.id === e.filialId) : undefined;
    if (e.filialId !== undefined && !filial) {
      campos.filialId = ["Esta filial não existe. Escolha uma da lista."];
    }
    const garagem = e.garagemId ? cat.garagens.find((g) => g.id === e.garagemId) : undefined;
    if (e.garagemId !== undefined && !garagem) {
      campos.garagemId = ["Esta garagem não existe. Escolha uma da lista."];
    } else if (garagem && filial && garagem.filialId !== filial.id) {
      campos.garagemId = ["Esta garagem não é da filial escolhida. Escolha uma garagem dela."];
    }
    return { campos, gestor, operacao, cr, marca, modelo, filial, garagem };
  }

  return {
    obterPlaca,
    eventosDaPlaca,
    placasParaLista,
    catalogos: () => ({
      marcas: [...cat.marcas],
      modelos: [...cat.modelos],
      gestores: [...cat.gestores],
      operacoes: [...cat.operacoes],
      crs: [...cat.crs],
      filiais: [...cat.filiais],
      garagens: [...cat.garagens],
      motoristas: [...cat.motoristas],
    }),
    placasCadastradas: () => cadastradas.map((p) => gravadas.get(p) as PlacaGravada),
    pedidoPendenteDa(placa) {
      const pedido = [...pedidos.values()].find(
        (p) => p.placa === placa && p.situacao === "pendente",
      );
      return pedido ?? null;
    },
    pedidosPendentes: () => [...pedidos.values()].filter((p) => p.situacao === "pendente"),

    candidatosDoConjunto(placa) {
      const alvo = obterPlaca(placa);
      if (!alvo || (alvo.tipo !== "cavalo" && alvo.tipo !== "implemento")) return [];
      const atuais = placasParaLista();
      const minhaId = atuais.find((p) => p.placa === placa)?.id;
      const candidatos =
        alvo.tipo === "cavalo"
          ? atuais.filter(
              (p) =>
                p.tipo === "implemento" &&
                (p.conjunto.cavaloId === null || p.conjunto.cavaloId === minhaId),
            )
          : atuais.filter((p) => p.tipo === "cavalo");
      return candidatos.map((p) => ({
        id: p.id,
        nome: `${p.placa} · ${p.modelo}`,
        carroceria: carroceriaDoModelo(p.modelo),
      }));
    },

    criarItemDeCatalogo(entrada, chave) {
      return unica("catalogo", chave, () => {
        const nome = entrada.nome.trim();
        const paiId = "paiId" in entrada ? entrada.paiId : undefined;
        const campos: Record<string, string[]> = {};
        const pai =
          entrada.tipo === "modelo"
            ? cat.marcas.find((m) => m.id === paiId)
            : entrada.tipo === "cr"
              ? cat.operacoes.find((o) => o.id === paiId)
              : entrada.tipo === "garagem"
                ? cat.filiais.find((f) => f.id === paiId)
                : undefined;
        if (paiId !== undefined && !pai) {
          campos.paiId = ["Este cadastro de origem não existe. Escolha outro."];
        }
        const chaveDoNome = simples(nome);
        const repetido = (() => {
          switch (entrada.tipo) {
            case "marca":
              return cat.marcas.some((m) => simples(m.nome) === chaveDoNome);
            case "modelo":
              return cat.modelos.some(
                (m) => m.marcaId === paiId && simples(m.nome) === chaveDoNome,
              );
            case "gestor":
              return cat.gestores.some((g) => simples(g.nome) === chaveDoNome);
            case "operacao":
              return cat.operacoes.some((o) => simples(o.nome) === chaveDoNome);
            case "cr":
              return cat.crs.some((c) => simples(c.codigo) === chaveDoNome);
            case "filial":
              return cat.filiais.some((f) => simples(f.nome) === chaveDoNome);
            case "garagem":
              return cat.garagens.some(
                (g) => g.filialId === paiId && simples(g.nome) === chaveDoNome,
              );
          }
        })();
        if (repetido)
          campos.nome = ["Já existe um cadastro com este nome. Escolha o que já existe."];
        if (Object.keys(campos).length > 0)
          return erroDaAcao<Atual>("entrada_invalida", { campos });

        const usados = new Set([
          ...cat.marcas.map((x) => x.id),
          ...cat.modelos.map((x) => x.id),
          ...cat.gestores.map((x) => x.id),
          ...cat.operacoes.map((x) => x.id),
          ...cat.crs.map((x) => x.id),
          ...cat.filiais.map((x) => x.id),
          ...cat.garagens.map((x) => x.id),
        ]);
        const id = idDoItem(entrada.tipo, nome, usados);
        switch (entrada.tipo) {
          case "marca":
            cat.marcas.push({ id, nome });
            break;
          case "modelo":
            cat.modelos.push({ id, nome, marcaId: paiId as string });
            break;
          case "gestor":
            cat.gestores.push({ id, nome });
            break;
          case "operacao":
            cat.operacoes.push({ id, nome });
            break;
          case "cr":
            cat.crs.push({ id, codigo: nome, operacaoId: paiId as string });
            break;
          case "filial":
            cat.filiais.push({ id, nome });
            break;
          case "garagem":
            cat.garagens.push({ id, nome, filialId: paiId as string });
            break;
        }
        return sucesso({ tipo: entrada.tipo, id, nome, ...(paiId !== undefined ? { paiId } : {}) });
      });
    },

    cadastrar(entrada, chave, agora) {
      return unica("cadastrar", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const existente = obterPlaca(placa);
        if (existente) return erroDaAcao<Atual>("placa_ja_existe", { atual: existente });
        const r = conferirReferencias(entrada);
        if (Object.keys(r.campos).length > 0) {
          return erroDaAcao<Atual>("entrada_invalida", { campos: r.campos });
        }
        const gestor = r.gestor!;
        const valor: ValorDaPlaca =
          "codigoFipe" in entrada
            ? {
                codigoFipe: entrada.codigoFipe,
                valorFipeCentavos: entrada.valorFipeCentavos,
                valorManualCentavos: null,
                fonteDoValor: null,
                dataDoValor: null,
              }
            : {
                codigoFipe: null,
                valorFipeCentavos: null,
                valorManualCentavos: entrada.valorManualCentavos,
                fonteDoValor: entrada.fonteDoValor,
                dataDoValor: entrada.dataDoValor,
              };
        const nova: PlacaGravada = {
          placa,
          tipo: entrada.tipo,
          renavam: entrada.renavam,
          marcaId: r.marca!.id,
          marca: r.marca!.nome,
          modeloId: r.modelo!.id,
          modelo: r.modelo!.nome,
          ano: entrada.ano,
          sigla: entrada.situacaoInicial,
          desde: agora,
          gestorId: gestor.id,
          gestor: gestor.nome,
          operacaoId: r.operacao?.id ?? null,
          operacao: r.operacao?.nome ?? null,
          crId: r.cr?.id ?? null,
          crs:
            r.cr && r.operacao
              ? [{ codigo: r.cr.codigo, nome: r.operacao.nome, inicio: dia(agora), fim: null }]
              : [],
          filialId: r.filial!.id,
          filial: r.filial!.nome,
          garagemId: r.garagem!.id,
          garagem: r.garagem!.nome,
          motoristaId: null,
          metaDoConjuntoCentavos: null,
          valor,
          conjunto: { cavaloId: null, implementoIds: [] },
          versao: 1,
          gestores: [{ gestorId: gestor.id, gestor: gestor.nome, inicio: agora, fim: null }],
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
        if (atual.versao !== entrada.versaoDaPlaca) return emConflito(atual);
        const motivo = motivoDeNaoDisponibilizar({ sigla: atual.sigla, tipo: atual.tipo });
        if (motivo !== null) {
          return erroDaAcao<Atual>("entrada_invalida", { campos: { placa: [motivo] } });
        }
        const filial = cat.filiais.find((f) => f.id === entrada.filialId);
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
        if (pedido.situacao !== "pendente" || pedido.versao !== entrada.versaoDoPedido) {
          return emConflito(pedido);
        }
        const pode = podeReceberPedido(pedido, gestorId);
        if (!pode.ok) return erroDaAcao<Atual>("sem_permissao");
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        if (atual.versao !== entrada.versaoDaPlaca) return emConflito(atual);
        const destino = cat.gestores.find((g) => g.id === pedido.paraGestorId);
        const operacao = entrada.operacaoId
          ? cat.operacoes.find((o) => o.id === entrada.operacaoId)
          : undefined;
        const cr = entrada.crId ? cat.crs.find((c) => c.id === entrada.crId) : undefined;
        const campos: Record<string, string[]> = {};
        if (entrada.operacaoId && !operacao) campos.operacaoId = ["Esta operação não existe."];
        if (entrada.crId && !cr) campos.crId = ["Este CR não existe."];
        else if (cr && operacao && cr.operacaoId !== operacao.id) {
          campos.crId = ["Este CR não é da operação escolhida."];
        }
        if (entrada.motoristaId && !cat.motoristas.some((m) => m.id === entrada.motoristaId)) {
          campos.motoristaId = ["Este motorista não existe."];
        }
        if (!destino) campos.placa = ["O gestor de destino do pedido não existe mais."];
        if (atual.tipo !== "cavalo" && entrada.metaDoConjuntoCentavos !== null) {
          campos.metaDoConjuntoCentavos = ["A meta do conjunto é do cavalo. Deixe-a vazia."];
        }
        if (Object.keys(campos).length > 0)
          return erroDaAcao<Atual>("entrada_invalida", { campos });

        const fechadas = atual.gestores.map((v, i, todas) =>
          i === todas.length - 1 ? { ...v, fim: agora } : v,
        );
        const trocouDeCr = (cr?.id ?? null) !== atual.crId;
        const crs = trocouDeCr
          ? [
              ...atual.crs.map((c) => (c.fim === null ? { ...c, fim: dia(agora) } : c)),
              ...(cr && operacao
                ? [{ codigo: cr.codigo, nome: operacao.nome, inicio: dia(agora), fim: null }]
                : []),
            ]
          : atual.crs;
        const nova: PlacaGravada = {
          ...atual,
          sigla: entrada.situacao,
          desde: agora,
          gestorId: destino!.id,
          gestor: destino!.nome,
          operacaoId: operacao?.id ?? null,
          operacao: operacao?.nome ?? null,
          crId: cr?.id ?? null,
          crs,
          motoristaId: entrada.motoristaId,
          metaDoConjuntoCentavos: entrada.metaDoConjuntoCentavos,
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
const SESSAO_VALIDA = /^[a-z0-9-]{8,64}$/;
const LIMITE_DE_SESSOES = 50;

/** O armazém padrão e o de cada sessão (cookie), do mais antigo ao mais recente uso. */
function armazensDoProcesso(): Map<string, Armazem> {
  const global = globalThis as unknown as Record<symbol, Map<string, Armazem> | undefined>;
  return (global[CHAVE_DO_PROCESSO] ??= new Map());
}

function novoArmazemDeExemplo(hoje: string): Armazem {
  const placasBase = placasDeExemplo(hoje);
  const comPedido = placasBase.find(
    (p) => p.gestor === GESTORES[0]?.nome && p.sigla !== "VND" && p.sigla !== "SUC",
  );
  return criarArmazem({
    placasBase,
    pedidosBase: comPedido
      ? [
          {
            id: "ped-exemplo-1",
            placa: comPedido.placa,
            deGestorId: GESTORES[0]!.id,
            paraGestorId: GESTORES[1]!.id,
            motivo: "Troca de carteira entre filiais",
            pendenciasConhecidas: [
              { id: "pend-1", texto: "CRLV vence em breve" },
              { id: "pend-2", texto: "Revisão dos 100 mil km em aberto" },
            ],
            situacao: "pendente",
            versao: 1,
          },
        ]
      : [],
  });
}

/**
 * O armazém do processo, que sobrevive ao recarregar de módulo em desenvolvimento (`globalThis`).
 * Sem `sessao`, é o armazém padrão, um só. Com uma sessão (o valor de um cookie, só letras minúsculas,
 * algarismos e hífen, de 8 a 64 caracteres), cada uma tem o seu, isolado dos outros: assim os testes de
 * tela que gravam não mexem nas contagens uns dos outros. Guarda no máximo 50 sessões (sai a menos
 * usada); uma sessão com formato estranho cai no armazém padrão. Nasce das placas de exemplo de
 * `hoje` e de um pedido de transferência de exemplo.
 */
export function armazemDoProcesso(hoje: string, sessao?: string): Armazem {
  const todos = armazensDoProcesso();
  const chave = sessao !== undefined && SESSAO_VALIDA.test(sessao) ? `sessao:${sessao}` : "padrao";
  const existente = todos.get(chave);
  if (existente) {
    todos.delete(chave); // volta ao fim: é o mais recente
    todos.set(chave, existente);
    return existente;
  }
  const criado = novoArmazemDeExemplo(hoje);
  todos.set(chave, criado);
  const sessoes = [...todos.keys()].filter((k) => k !== "padrao");
  for (const antiga of sessoes.slice(0, Math.max(0, sessoes.length - LIMITE_DE_SESSOES))) {
    todos.delete(antiga);
  }
  return criado;
}
