import {
  motivoDeNaoEntregar,
  pedidoAberto,
  podeConcluirRecebimento,
  podeCancelarPedido,
  podeDevolverPedido,
  podeReceberPedido,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import type {
  EntradaCadastrarPlaca,
  EntradaCancelarPedido,
  EntradaConcluirRecebimento,
  EntradaDevolverPlaca,
  EntradaDisponibilizarPlaca,
  EntradaEntregaAoOperacional,
  EntradaItemDeCatalogo,
  EntradaReceberPlaca,
  TipoDeItemDeCatalogo,
} from "@/lib/dominio/esquemas/placa";
import type {
  EntradaCorrigirPlaca,
  EntradaDesatrelar,
  EntradaEngatar,
  EntradaMudarSituacao,
} from "@/lib/dominio/esquemas/ficha-da-placa";
import type { EventoDeStatus } from "@/lib/dominio/linha-do-tempo";
import { normalizarPlaca } from "@/lib/dominio/placa";
import { SIGLAS_DE_BAIXA, type Sigla } from "@/lib/dominio/status";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { CARROCERIAS, CRS, FILIAIS, GESTORES, MARCAS, MODELOS, OPERACOES } from "./catalogos";
import type {
  Catalogos,
  ConjuntoDaPlaca,
  ItemCriado,
  PlacaGravada,
  ValorDaPlaca,
} from "@/lib/dados/escrita-tipos";
import { eventosDeExemplo } from "./eventos";
import { placasDeExemplo } from "./placas";
import type { PlacaDeExemplo } from "./tipos";

export type {
  Catalogos,
  ItemCriado,
  PlacaGravada,
  ValorDaPlaca,
  VigenciaDeCr,
  VigenciaDeGestor,
} from "@/lib/dados/escrita-tipos";

// Escrita de exemplo, em memória, sem banco: cadastrar placa, entregar ao Operacional, disponibilizar
// placa (enviar a outro gestor), receber placa e concluir o recebimento (as duas etapas), e criar
// itens de catálogo (o que o "+" cadastra). Tem as mesmas regras que a gravação no banco: chave de
// envio (clique duplo e nova tentativa gravam uma vez), versão por registro (edição concorrente),
// placa única em qualquer formato, filhos que pertencem ao pai escolhido (modelo da marca) e evento
// com hora a cada mudança de situação. O estado vive na memória do processo (some ao reiniciar).
// Nunca é importado fora de desenvolvimento e testes (ver lib/qualidade/barramento-do-exemplo.ts); a
// Server Action chega aqui por lib/dados/fonte-de-exemplo.ts.

type Atual = PlacaGravada | PedidoDeTransferencia;
type Resultado<T> = ResultadoDaAcao<T, Atual>;

export interface Armazem {
  cadastrar(entrada: EntradaCadastrarPlaca, chave: string, agora: string): Resultado<PlacaGravada>;
  entregar(
    entrada: EntradaEntregaAoOperacional,
    chave: string,
    agora: string,
  ): Resultado<PlacaGravada>;
  disponibilizar(
    entrada: EntradaDisponibilizarPlaca,
    chave: string,
    agora: string,
  ): Resultado<PedidoDeTransferencia>;
  receber(
    entrada: EntradaReceberPlaca,
    chave: string,
    agora: string,
    gestorId: string,
  ): Resultado<PedidoDeTransferencia>;
  concluir(
    entrada: EntradaConcluirRecebimento,
    chave: string,
    agora: string,
    gestorId: string,
  ): Resultado<PlacaGravada>;
  mudarSituacao(
    entrada: EntradaMudarSituacao,
    chave: string,
    agora: string,
  ): Resultado<PlacaGravada>;
  engatar(entrada: EntradaEngatar, chave: string, agora: string): Resultado<PlacaGravada>;
  desatrelar(entrada: EntradaDesatrelar, chave: string, agora: string): Resultado<PlacaGravada>;
  corrigir(entrada: EntradaCorrigirPlaca, chave: string, agora: string): Resultado<PlacaGravada>;
  conjuntoDaPlaca(placa: string): ConjuntoDaPlaca | null;
  /** Os implementos que não estão em nenhum conjunto e podem entrar num (não baixados nem fora da frota). */
  implementosLivres(): PlacaDeExemplo[];
  cancelar(
    entrada: EntradaCancelarPedido,
    chave: string,
    agora: string,
    gestorId: string,
  ): Resultado<PedidoDeTransferencia>;
  devolver(
    entrada: EntradaDevolverPlaca,
    chave: string,
    agora: string,
    gestorId: string,
  ): Resultado<PedidoDeTransferencia>;
  criarItemDeCatalogo(entrada: EntradaItemDeCatalogo, chave: string): Resultado<ItemCriado>;
  catalogos(): Catalogos;
  obterPlaca(placa: string): PlacaGravada | null;
  eventosDaPlaca(placa: string): EventoDeStatus[];
  /** O pedido aberto (pendente ou em conferência) da placa, se houver. */
  pedidoAbertoDa(placa: string): PedidoDeTransferencia | null;
  /** Os pedidos abertos para o gestor (as duas etapas do recebimento). */
  pedidosParaReceber(gestorId: string): PedidoDeTransferencia[];
  placasCadastradas(): PlacaGravada[];
  /** As placas como a lista e a ficha as veem: as de base já com as mudanças, mais as cadastradas. */
  placasParaLista(): PlacaDeExemplo[];
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
    garagem: "—",
    valor: {
      codigoFipe: null,
      valorFipeCentavos: p.valorFipeCentavos,
      valorManualCentavos: null,
      fonteDoValor: null,
      dataDoValor: null,
    },
    versao: 1,
    gestores: [
      { gestorId: gestor?.id ?? "", gestor: p.gestor, inicio: p.desde.slice(0, 16), fim: null },
    ],
  };
}

function paraExemplo(
  g: PlacaGravada,
  base: PlacaDeExemplo | undefined,
  conjunto?: PlacaDeExemplo["conjunto"],
): PlacaDeExemplo {
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
    motorista: base?.motorista ?? null,
    crlvVenceEm: base?.crlvVenceEm ?? null,
    km: base?.km ?? null,
    valorFipeCentavos: g.valor.valorFipeCentavos ?? base?.valorFipeCentavos ?? null,
    conjunto: conjunto
      ? { cavaloId: conjunto.cavaloId, implementoIds: [...conjunto.implementoIds] }
      : base
        ? { cavaloId: base.conjunto.cavaloId, implementoIds: [...base.conjunto.implementoIds] }
        : { cavaloId: null, implementoIds: [] },
  };
}

function idDoItem(
  tipo: TipoDeItemDeCatalogo,
  nome: string,
  existentes: ReadonlySet<string>,
): string {
  const prefixo = tipo === "operacao" ? "op" : tipo;
  const corpo = simples(nome)
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
    carrocerias: [...CARROCERIAS],
    gestores: [...GESTORES],
    operacoes: [...OPERACOES],
    crs: [...CRS],
    filiais: [...FILIAIS],
  };
  const base = new Map(placasBase.map((p) => [p.placa, p]));
  /** Placas mudadas ou cadastradas aqui (a base só é copiada na primeira mudança). */
  const gravadas = new Map<string, PlacaGravada>();
  const cadastradas: string[] = [];
  const eventos = new Map<string, EventoDeStatus[]>();
  const pedidos = new Map(pedidosBase.map((p) => [p.id, { ...p }]));
  /** Resultado de cada envio que deu certo, por ação e chave: o mesmo envio de novo devolve o mesmo. */
  const enviados = new Map<string, Resultado<unknown>>();
  let proximoPedido = 1;

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
    const todos = [...eventosDaPlaca(placa), { sigla, em }];
    eventos.set(
      placa,
      todos.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0)),
    );
  };
  /** Composição mudada aqui (a base só é copiada na primeira mudança): por placa, ids da lista de exemplo. */
  const conjuntos = new Map<string, PlacaDeExemplo["conjunto"]>();
  const idDaPlaca = (placa: string) => base.get(placa)?.id ?? `pl-${placa}`;
  const conjuntoDe = (placa: string): PlacaDeExemplo["conjunto"] =>
    conjuntos.get(placa) ?? base.get(placa)?.conjunto ?? { cavaloId: null, implementoIds: [] };
  const placaDoId = (id: string): string | null =>
    [...base.values(), ...cadastradas.map((p) => ({ id: idDaPlaca(p), placa: p }))].find(
      (p) => p.id === id,
    )?.placa ?? null;
  const guardar = (placa: PlacaGravada) => void gravadas.set(placa.placa, placa);
  const placasParaLista = (): PlacaDeExemplo[] => [
    ...placasBase.map((p) => {
      const g = gravadas.get(p.placa);
      return g ? paraExemplo(g, p, conjuntos.get(p.placa)) : p;
    }),
    ...cadastradas.map((placa) =>
      paraExemplo(gravadas.get(placa) as PlacaGravada, undefined, conjuntos.get(placa)),
    ),
  ];
  const pedidoAbertoDa = (placa: string) =>
    [...pedidos.values()].find((p) => p.placa === placa && pedidoAberto(p)) ?? null;

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
  const invalida = (campos: Record<string, string[]>) =>
    erroDaAcao<Atual>("entrada_invalida", { campos });

  /** Confere gestor, operação, CR, marca, modelo e carroceria escolhidos; devolve os erros por campo. */
  function conferirReferencias(e: EntradaCadastrarPlaca) {
    const campos: Record<string, string[]> = {};
    const gestor = cat.gestores.find((g) => g.id === e.gestorId);
    if (!gestor) campos.gestorId = ["Este gestor não existe. Escolha um da lista."];
    const operacao = cat.operacoes.find((o) => o.id === e.operacaoId);
    if (!operacao) campos.operacaoId = ["Esta operação não existe. Escolha uma da lista."];
    const cr = cat.crs.find((c) => c.id === e.crId);
    if (!cr) campos.crId = ["Este CR não existe. Escolha um da lista."];
    else if (operacao && cr.operacaoId !== null && cr.operacaoId !== operacao.id) {
      campos.crId = ["Este CR é de outra operação. Escolha um CR desta operação."];
    }
    const marca = cat.marcas.find((m) => m.id === e.marcaId);
    if (!marca) campos.marcaId = ["Esta marca não existe. Escolha uma da lista."];
    const modelo = cat.modelos.find((m) => m.id === e.modeloId);
    if (!modelo) campos.modeloId = ["Este modelo não existe. Escolha um da lista."];
    else if (marca && modelo.marcaId !== marca.id) {
      campos.modeloId = ["Este modelo não é da marca escolhida. Escolha um modelo dela."];
    }
    if (
      e.tipo === "implemento" &&
      e.carroceriaId !== null &&
      !cat.carrocerias.some((c) => c.id === e.carroceriaId)
    ) {
      campos.carroceriaId = ["Esta carroceria não existe. Escolha uma da lista."];
    }
    return { campos, gestor, operacao, cr, marca, modelo };
  }

  return {
    obterPlaca,
    eventosDaPlaca,
    placasParaLista,
    pedidoAbertoDa,
    catalogos: () => ({
      marcas: [...cat.marcas],
      modelos: [...cat.modelos],
      carrocerias: [...cat.carrocerias],
      gestores: [...cat.gestores],
      operacoes: [...cat.operacoes],
      crs: [...cat.crs],
      filiais: [...cat.filiais],
    }),
    conjuntoDaPlaca(placa) {
      const conj = conjuntoDe(placa);
      const cavalo = conj.cavaloId !== null ? placaDoId(conj.cavaloId) : null;
      const ids = cavalo !== null ? conjuntoDe(cavalo).implementoIds : conj.implementoIds;
      const implementos = ids.map(placaDoId).filter((p): p is string => p !== null);
      const mestre = cavalo ?? (implementos.length > 0 ? placa : null);
      if (mestre === null || implementos.length === 0) return null;
      const quantos = `${implementos.length} ${implementos.length === 1 ? "implemento" : "implementos"}`;
      return { cavalo: mestre, implementos, nome: `Conjunto de ${quantos}` };
    },
    implementosLivres: () =>
      placasParaLista().filter(
        (p) =>
          p.tipo === "implemento" &&
          p.conjunto.cavaloId === null &&
          !SIGLAS_DE_BAIXA.includes(p.sigla) &&
          !["ALU", "EMP", "VEN"].includes(p.sigla),
      ),

    mudarSituacao(entrada, chave) {
      return unica("mudar-situacao", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        if (SIGLAS_DE_BAIXA.includes(atual.sigla)) {
          return invalida({ placa: ["Placa baixada não muda de situação."] });
        }
        registrar(placa, entrada.sigla, entrada.quando);
        const ultimo = eventosDaPlaca(placa).at(-1) as EventoDeStatus;
        const nova: PlacaGravada = {
          ...atual,
          sigla: ultimo.sigla as Sigla,
          desde: ultimo.em,
          versao: atual.versao + 1,
        };
        guardar(nova);
        return sucesso(nova);
      });
    },

    engatar(entrada, chave) {
      return unica("engatar", chave, () => {
        const cavalo = obterPlaca(normalizarPlaca(entrada.placa));
        const implemento = obterPlaca(normalizarPlaca(entrada.implemento));
        if (!cavalo || !implemento) return erroDaAcao<Atual>("nao_encontrado");
        if (cavalo.tipo !== "cavalo") {
          return invalida({ placa: ["Só um cavalo recebe implementos."] });
        }
        if (implemento.tipo !== "implemento") {
          return invalida({ implemento: ["Só um implemento entra no conjunto."] });
        }
        if (conjuntoDe(implemento.placa).cavaloId !== null) {
          return invalida({ implemento: ["Este implemento já está engatado em outro cavalo."] });
        }
        const doCavalo = conjuntoDe(cavalo.placa);
        if (doCavalo.implementoIds.length >= 3) {
          return invalida({ implemento: ["O conjunto tem no máximo três unidades."] });
        }
        conjuntos.set(cavalo.placa, {
          cavaloId: null,
          implementoIds: [...doCavalo.implementoIds, idDaPlaca(implemento.placa)],
        });
        conjuntos.set(implemento.placa, { cavaloId: idDaPlaca(cavalo.placa), implementoIds: [] });
        guardar({ ...implemento, versao: implemento.versao + 1 });
        const nova = { ...cavalo, versao: cavalo.versao + 1 };
        guardar(nova);
        return sucesso(nova);
      });
    },

    desatrelar(entrada, chave) {
      return unica("desatrelar", chave, () => {
        const cavalo = obterPlaca(normalizarPlaca(entrada.placa));
        if (!cavalo) return erroDaAcao<Atual>("nao_encontrado");
        const doCavalo = conjuntoDe(cavalo.placa);
        const saem = entrada.implementos.map((p) => idDaPlaca(normalizarPlaca(p)));
        if (!saem.every((id) => doCavalo.implementoIds.includes(id))) {
          return invalida({ implementos: ["Há implemento que não está engatado neste cavalo."] });
        }
        conjuntos.set(cavalo.placa, {
          cavaloId: null,
          implementoIds: doCavalo.implementoIds.filter((id) => !saem.includes(id)),
        });
        for (const placaDoImplemento of entrada.implementos) {
          const implemento = obterPlaca(normalizarPlaca(placaDoImplemento));
          if (!implemento) continue;
          conjuntos.set(implemento.placa, { cavaloId: null, implementoIds: [] });
          guardar({ ...implemento, versao: implemento.versao + 1 });
        }
        const nova = { ...cavalo, versao: cavalo.versao + 1 };
        guardar(nova);
        return sucesso(nova);
      });
    },

    corrigir(entrada, chave) {
      return unica("corrigir", chave, () => {
        const atual = obterPlaca(normalizarPlaca(entrada.placa));
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        if (atual.versao !== entrada.versaoDaPlaca) return emConflito(atual);
        if (entrada.renavam !== undefined && atual.renavam !== "") {
          return invalida({ renavam: ["O RENAVAM já está preenchido e não aceita correção."] });
        }
        const nova: PlacaGravada = {
          ...atual,
          renavam: entrada.renavam ?? atual.renavam,
          versao: atual.versao + 1,
        };
        guardar(nova);
        return sucesso(nova);
      });
    },

    placasCadastradas: () => cadastradas.map((p) => gravadas.get(p) as PlacaGravada),
    pedidosParaReceber: (gestorId) =>
      [...pedidos.values()].filter((p) => pedidoAberto(p) && p.paraGestorId === gestorId),

    criarItemDeCatalogo(entrada, chave) {
      return unica("catalogo", chave, () => {
        const nome = entrada.nome.trim();
        const paiId = "paiId" in entrada ? entrada.paiId : undefined;
        const campos: Record<string, string[]> = {};
        const pai =
          entrada.tipo === "modelo"
            ? cat.marcas.find((m) => m.id === paiId)
            : entrada.tipo === "cr" && paiId !== undefined
              ? cat.operacoes.find((o) => o.id === paiId)
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
          }
        })();
        if (repetido)
          campos.nome = ["Já existe um cadastro com este nome. Escolha o que já existe."];
        if (Object.keys(campos).length > 0) return invalida(campos);

        const usados = new Set([
          ...cat.marcas.map((x) => x.id),
          ...cat.modelos.map((x) => x.id),
          ...cat.gestores.map((x) => x.id),
          ...cat.operacoes.map((x) => x.id),
          ...cat.crs.map((x) => x.id),
          ...cat.filiais.map((x) => x.id),
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
            cat.crs.push({ id, codigo: nome, operacaoId: paiId ?? null });
            break;
          case "filial":
            cat.filiais.push({ id, nome });
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
        if (Object.keys(r.campos).length > 0) return invalida(r.campos);
        const gestor = r.gestor!;
        const operacao = r.operacao!;
        const cr = r.cr!;
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
          renavam: entrada.tipo === "equipamento" ? "" : entrada.renavam,
          marcaId: r.marca!.id,
          marca: r.marca!.nome,
          modeloId: r.modelo!.id,
          modelo: r.modelo!.nome,
          ano: entrada.ano,
          sigla: entrada.situacaoInicial,
          desde: agora,
          gestorId: gestor.id,
          gestor: gestor.nome,
          operacaoId: operacao.id,
          operacao: operacao.nome,
          crId: cr.id,
          crs: [{ codigo: cr.codigo, nome: operacao.nome, inicio: dia(agora), fim: null }],
          filialId: null,
          filial: "Sem filial",
          garagem: "—",
          valor,
          versao: 1,
          gestores: [{ gestorId: gestor.id, gestor: gestor.nome, inicio: agora, fim: null }],
        };
        guardar(nova);
        cadastradas.push(placa);
        registrar(placa, nova.sigla, agora);
        return sucesso(nova);
      });
    },

    entregar(entrada, chave, agora) {
      return unica("entregar", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        if (atual.versao !== entrada.versaoDaPlaca) return emConflito(atual);
        const motivo = motivoDeNaoEntregar({ sigla: atual.sigla, tipo: atual.tipo });
        if (motivo !== null) return invalida({ placa: [motivo] });
        const filial = cat.filiais.find((f) => f.id === entrada.filialId);
        if (!filial)
          return invalida({ filialId: ["Esta filial não existe. Escolha uma da lista."] });
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

    disponibilizar(entrada, chave) {
      return unica("disponibilizar", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        if (atual.versao !== entrada.versaoDaPlaca) return emConflito(atual);
        if (SIGLAS_DE_BAIXA.includes(atual.sigla)) {
          return invalida({ placa: ["Placa baixada não se disponibiliza."] });
        }
        if (pedidoAbertoDa(placa)) {
          return erroDaAcao<Atual>("entrada_invalida", {
            mensagem:
              "Esta placa já tem um pedido de transferência aberto. Espere a resposta ou fale com quem vai receber.",
          });
        }
        const destino = cat.gestores.find((g) => g.id === entrada.paraGestorId);
        if (!destino) {
          return invalida({ paraGestorId: ["Este gestor não existe. Escolha um da lista."] });
        }
        if (destino.id === atual.gestorId) {
          return invalida({ paraGestorId: ["A placa já está na carteira deste gestor."] });
        }
        const id = `ped-${proximoPedido++}-${placa}`;
        const pedido: PedidoDeTransferencia = {
          id,
          placa,
          deGestorId: atual.gestorId ?? "",
          deGestor: atual.gestor,
          paraGestorId: destino.id,
          paraGestor: destino.nome,
          motivo: entrada.motivo,
          pendenciasConhecidas: entrada.pendenciasConhecidas.map((texto, i) => ({
            id: `${id}-p${i + 1}`,
            texto,
          })),
          situacao: "pendente",
          versao: 1,
        };
        pedidos.set(id, pedido);
        return sucesso(pedido);
      });
    },

    receber(entrada, chave, _agora, gestorId) {
      return unica("receber", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const pedido = pedidos.get(entrada.pedidoId);
        if (!pedido) return erroDaAcao<Atual>("nao_encontrado");
        if (pedido.placa !== placa) {
          return invalida({ placa: ["Este pedido de transferência é de outra placa."] });
        }
        if (pedido.versao !== entrada.versaoDoPedido) return emConflito(pedido);
        const pode = podeReceberPedido(pedido, gestorId);
        if (!pode.ok) {
          return pode.motivo === "pedido_encerrado"
            ? emConflito(pedido)
            : erroDaAcao<Atual>("sem_permissao", {
                mensagem: "Só o gestor de destino recebe esta placa.",
              });
        }
        const recebido: PedidoDeTransferencia = {
          ...pedido,
          situacao: "em_conferencia",
          versao: pedido.versao + 1,
        };
        pedidos.set(pedido.id, recebido);
        return sucesso(recebido);
      });
    },

    concluir(entrada, chave, agora, gestorId) {
      return unica("concluir", chave, () => {
        const placa = normalizarPlaca(entrada.placa);
        const pedido = pedidos.get(entrada.pedidoId);
        if (!pedido) return erroDaAcao<Atual>("nao_encontrado");
        if (pedido.placa !== placa) {
          return invalida({ placa: ["Este pedido de transferência é de outra placa."] });
        }
        if (pedido.versao !== entrada.versaoDoPedido) return emConflito(pedido);
        const pode = podeConcluirRecebimento(pedido, gestorId);
        if (!pode.ok) {
          if (pode.motivo === "nao_e_o_destinatario") {
            return erroDaAcao<Atual>("sem_permissao", {
              mensagem: "Só o gestor de destino conclui esta transferência.",
            });
          }
          return pode.motivo === "pedido_nao_recebido"
            ? erroDaAcao<Atual>("entrada_invalida", {
                mensagem: "Receba a placa antes de concluir o recebimento.",
              })
            : emConflito(pedido);
        }
        const esperadas = pedido.pendenciasConhecidas.map((p) => p.id).sort();
        const respondidas = entrada.pendencias.map((p) => p.id).sort();
        if (esperadas.join("|") !== respondidas.join("|")) {
          return erroDaAcao<Atual>("entrada_invalida", {
            mensagem: "Responda cada pendência do pedido, uma vez.",
          });
        }
        const atual = obterPlaca(placa);
        if (!atual) return erroDaAcao<Atual>("nao_encontrado");
        const fechadas = atual.gestores.map((v, i, todas) =>
          i === todas.length - 1 ? { ...v, fim: agora } : v,
        );
        const nova: PlacaGravada = {
          ...atual,
          gestorId: pedido.paraGestorId,
          gestor: pedido.paraGestor,
          versao: atual.versao + 1,
          gestores: [
            ...fechadas,
            { gestorId: pedido.paraGestorId, gestor: pedido.paraGestor, inicio: agora, fim: null },
          ],
        };
        guardar(nova);
        pedidos.set(pedido.id, { ...pedido, situacao: "concluido", versao: pedido.versao + 1 });
        return sucesso(nova);
      });
    },

    cancelar(entrada, chave, _agora, gestorId) {
      return unica("cancelar", chave, () => {
        const pedido = pedidos.get(entrada.pedidoId);
        if (!pedido || pedido.placa !== normalizarPlaca(entrada.placa)) {
          return erroDaAcao<Atual>("nao_encontrado");
        }
        const pode = podeCancelarPedido(pedido, gestorId);
        if (!pode.ok && pode.motivo === "nao_e_a_origem") {
          return erroDaAcao<Atual>("sem_permissao", {
            mensagem: "Só o gestor de origem cancela este pedido.",
          });
        }
        if (pedido.versao !== entrada.versaoDoPedido || !pode.ok) return emConflito(pedido);
        const cancelado: PedidoDeTransferencia = {
          ...pedido,
          situacao: "cancelado",
          versao: pedido.versao + 1,
        };
        pedidos.set(pedido.id, cancelado);
        return sucesso(cancelado);
      });
    },

    devolver(entrada, chave, _agora, gestorId) {
      return unica("devolver", chave, () => {
        const pedido = pedidos.get(entrada.pedidoId);
        if (!pedido || pedido.placa !== normalizarPlaca(entrada.placa)) {
          return erroDaAcao<Atual>("nao_encontrado");
        }
        const pode = podeDevolverPedido(pedido, gestorId);
        if (!pode.ok && pode.motivo === "nao_e_o_destinatario") {
          return erroDaAcao<Atual>("sem_permissao", {
            mensagem: "Só o gestor de destino devolve esta placa.",
          });
        }
        if (!pode.ok && pode.motivo === "pedido_nao_recebido") {
          return erroDaAcao<Atual>("entrada_invalida", {
            mensagem: "Só se devolve um pedido em conferência: receba a placa antes de devolvê-la.",
          });
        }
        if (pedido.versao !== entrada.versaoDoPedido || !pode.ok) return emConflito(pedido);
        const devolvido: PedidoDeTransferencia = {
          ...pedido,
          situacao: "devolvido",
          versao: pedido.versao + 1,
        };
        pedidos.set(pedido.id, devolvido);
        return sucesso(devolvido);
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
            deGestor: GESTORES[0]!.nome,
            paraGestorId: GESTORES[1]!.id,
            paraGestor: GESTORES[1]!.nome,
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
