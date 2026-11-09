import { normalizar, notaDoNome } from "./busca";
import { CATALOGO, type IdDoModulo } from "./catalogo";
import type { Perfil } from "./perfis";
import { temOModulo, veEmBreve } from "./visibilidade";

/**
 * Ação que a busca rápida (Ctrl+K) oferece, como "Receber placa". Toda escrita usa o motor de
 * wizard (entrega 2D); até lá as ações ficam reservadas aqui como `em-breve`, no mesmo catálogo
 * das telas, e a busca as mostra sem executá-las.
 */
export interface AcaoDoCatalogo {
  readonly id: string;
  /** Verbo no infinitivo mais objeto: "Receber placa". */
  readonly nome: string;
  readonly icone: string;
  readonly modulo: IdDoModulo;
  readonly permissao: { readonly modulo: IdDoModulo; readonly acao: "criar" };
  readonly estado: "pronto" | "em-breve";
  /** Uma linha do que a ação fará. */
  readonly descricao: string;
  /** Para onde a busca rápida leva ao executar a ação (a tela com o assistente aberto, `?assistente=`). */
  readonly rota?: string;
}

export const ACOES: readonly AcaoDoCatalogo[] = [
  {
    id: "frota.cadastrar-placa",
    nome: "Cadastrar placa",
    icone: "IconCirclePlus",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Cadastra uma placa nova, com o tipo, o valor, o gestor, a operação e a situação inicial.",
    rota: "/frota/placas?assistente=cadastrar-placa",
  },
  {
    id: "frota.receber-placa",
    nome: "Receber placa",
    icone: "IconCirclePlus",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Registra a chegada da placa disponibilizada por outro gestor de frota; a carteira ainda não muda.",
    rota: "/frota/placas?assistente=receber-placa",
  },
  {
    id: "frota.concluir-recebimento",
    nome: "Concluir recebimento",
    icone: "IconChecklist",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Responde cada pendência da placa recebida de outro gestor e passa a placa para a sua carteira.",
    rota: "/frota/placas?assistente=concluir-recebimento",
  },
  {
    id: "frota.entregar-ao-operacional",
    nome: "Entregar ao Operacional",
    icone: "IconSend",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Passa a placa do gestor de frota para o Operacional da filial.",
    rota: "/frota/placas?assistente=entregar-ao-operacional",
  },
  {
    id: "frota.disponibilizar-placa",
    nome: "Disponibilizar placa",
    icone: "IconArrowsExchange",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Envia a placa a outro gestor de frota, com o motivo e as pendências conhecidas.",
    rota: "/frota/placas?assistente=disponibilizar-placa",
  },
  {
    id: "frota.mudar-situacao",
    nome: "Mudar situação",
    icone: "IconArrowsExchange",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Registra a nova situação da placa solta ou do conjunto, com a data e a hora da mudança.",
    rota: "/frota/placas?assistente=mudar-situacao",
  },
  {
    id: "frota.engatar-implemento",
    nome: "Engatar implemento",
    icone: "IconCirclePlus",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Engata um implemento solto no cavalo, na posição e no instante escolhidos.",
    rota: "/frota/placas?assistente=engatar-implemento",
  },
  {
    id: "frota.desatrelar-implemento",
    nome: "Desatrelar implemento",
    icone: "IconSend",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Tira um, vários ou todos os implementos do cavalo, que voltam ao pátio.",
    rota: "/frota/placas?assistente=desatrelar-implemento",
  },
  {
    id: "frota.corrigir-placa",
    nome: "Corrigir placa",
    icone: "IconChecklist",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Completa o RENAVAM e o número de série e corrige os eixos e a carroceria, com o motivo.",
    rota: "/frota/placas?assistente=corrigir-placa",
  },
  {
    id: "frota.cancelar-pedido",
    nome: "Cancelar pedido",
    icone: "IconArrowBackUp",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Desiste do pedido de transferência que você enviou, enquanto o outro gestor ainda não recebeu a placa.",
    rota: "/frota/placas?assistente=cancelar-pedido",
  },
  {
    id: "frota.devolver-placa",
    nome: "Devolver placa",
    icone: "IconArrowBackUp",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Recusa a placa recebida de outro gestor, com o motivo; ela continua na carteira de quem enviou.",
    rota: "/frota/placas?assistente=devolver-placa",
  },
];

function nomeDoModulo(id: IdDoModulo): string {
  return CATALOGO.find((m) => m.id === id)?.nome ?? id;
}

/** Em breve só para quem acompanha a obra; pronta para quem tem o módulo. */
export function podeVerAcao(perfil: Perfil, acao: AcaoDoCatalogo): boolean {
  if (!temOModulo(perfil, acao.permissao.modulo)) return false;
  return acao.estado === "pronto" || veEmBreve(perfil);
}

/** Ações que combinam com o termo (sem acento nem maiúscula), o nome que combina melhor primeiro. */
export function buscarAcoes(
  termo: string,
  perfil: Perfil,
  acoes: readonly AcaoDoCatalogo[] = ACOES,
): readonly AcaoDoCatalogo[] {
  const normalizado = normalizar(termo);
  if (normalizado === "") return [];
  const palavras = normalizado.split(" ");
  const primeiro = palavras[0] ?? normalizado;
  return acoes
    .filter((acao) => podeVerAcao(perfil, acao))
    .map((acao, ordem) => ({
      acao,
      ordem,
      texto: normalizar(`${nomeDoModulo(acao.modulo)} ${acao.nome}`),
    }))
    .filter(({ texto }) => palavras.every((palavra) => texto.includes(palavra)))
    .map((item) => ({
      ...item,
      nota: notaDoNome(normalizar(item.acao.nome), normalizado, primeiro),
    }))
    .sort((a, b) => a.nota - b.nota || a.ordem - b.ordem)
    .map(({ acao }) => acao);
}
