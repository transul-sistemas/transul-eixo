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
    nome: "Enviar placa",
    icone: "IconArrowsExchange",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Envia a placa a outro gestor de frota, com o motivo e as pendências conhecidas.",
    rota: "/frota/placas?assistente=disponibilizar-placa",
  },
  {
    id: "frota.confirmar-carteira",
    nome: "Confirmar carteira",
    icone: "IconChecklist",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Confirma, placa por placa, o que esteve com você no mês: está comigo, não é minha ou corrigir.",
    rota: "/frota/carteira?assistente=confirmar-carteira",
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
    nome: "Engatar implementos",
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
  {
    id: "frota.lancar-o-dia",
    nome: "Lançar o dia",
    icone: "IconChecklist",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Lança a mesma situação e a mesma hora para vários conjuntos de uma vez, tudo ou nada.",
    rota: "/frota/acompanhamento?assistente=lancar-o-dia",
  },
  {
    id: "frota.trocar-cr",
    nome: "Trocar CR",
    icone: "IconArrowsExchange",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Fecha o CR vigente da placa e abre o novo na mesma data, sem buraco; a placa muda de operação.",
    rota: "/frota/placas?assistente=trocar-cr",
  },
  {
    id: "frota.pedir-baixa",
    nome: "Pedir baixa",
    icone: "IconArrowBackUp",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Pede a baixa da placa (venda, sinistro, sucata ou devolução); a Diretoria aprova, e quem pede não aprova.",
    rota: "/frota/placas?assistente=pedir-baixa",
  },
  {
    id: "cadastros.resolver-saude-do-cr",
    nome: "Resolver a saúde do CR",
    icone: "IconListDetails",
    modulo: "cadastros",
    permissao: { modulo: "cadastros", acao: "criar" },
    estado: "pronto",
    descricao:
      "Abre a Saúde do CR: placa sem CR, CR sem operação, dois CRs do mesmo tipo e lançamento sem CR.",
    rota: "/cadastros/saude-do-cr",
  },
  {
    id: "frota.lancar-abastecimento",
    nome: "Lançar abastecimento",
    icone: "IconGasStation",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Lança à mão, como provisório, um abastecimento que ainda não chegou do Sankhya.",
    rota: "/frota/abastecimento?assistente=lancar-abastecimento",
  },
  {
    id: "resultados.fechar-mes",
    nome: "Fechar mês",
    icone: "IconLock",
    modulo: "resultados",
    permissao: { modulo: "resultados", acao: "criar" },
    estado: "pronto",
    descricao: "Grava a foto dos totais do mês; depois, só ajuste justificado muda o mês.",
    rota: "/resultados/fechamentos?assistente=fechar-mes",
  },
  {
    id: "resultados.reabrir-mes",
    nome: "Reabrir mês",
    icone: "IconArrowBackUp",
    modulo: "resultados",
    permissao: { modulo: "resultados", acao: "criar" },
    estado: "pronto",
    descricao: "Reabre um mês fechado, com o motivo registrado no histórico.",
    rota: "/resultados/fechamentos?assistente=reabrir-mes",
  },
  {
    id: "resultados.pedir-ajuste",
    nome: "Pedir ajuste",
    icone: "IconAdjustments",
    modulo: "resultados",
    permissao: { modulo: "resultados", acao: "criar" },
    estado: "pronto",
    descricao:
      "Pede um ajuste justificado ao resultado de uma operação; o fato do Sankhya não muda.",
    rota: "/resultados/ajustes?assistente=pedir-ajuste",
  },
  {
    id: "pessoas.registrar-status-do-dia",
    nome: "Registrar status do dia",
    icone: "IconCalendarCheck",
    modulo: "pessoas",
    permissao: { modulo: "pessoas", acao: "criar" },
    estado: "pronto",
    descricao: "Registra o realizado do dia de um motorista, distinto da escala.",
    rota: "/pessoas/status-diario?assistente=registrar-status-do-dia",
  },
  {
    id: "pessoas.indicar-substituto",
    nome: "Indicar substituto",
    icone: "IconUsers",
    modulo: "pessoas",
    permissao: { modulo: "pessoas", acao: "criar" },
    estado: "pronto",
    descricao: "Indica quem assume o conjunto do motorista ausente, no período escolhido.",
    rota: "/pessoas/status-diario?assistente=indicar-substituto",
  },
  {
    id: "frota.conferir-abastecimento",
    nome: "Conferir abastecimento",
    icone: "IconChecklist",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Confere o lançamento provisório com o abastecimento do Sankhya, ou o descarta com o motivo.",
    rota: "/frota/abastecimento?assistente=conferir-abastecimento",
  },
  {
    id: "resultados.decidir-ajuste",
    nome: "Decidir ajuste",
    icone: "IconChecklist",
    modulo: "resultados",
    permissao: { modulo: "resultados", acao: "criar" },
    estado: "pronto",
    descricao: "Aprova ou recusa um ajuste pedido; só a Diretoria, e quem pediu não decide.",
    rota: "/resultados/ajustes?assistente=decidir-ajuste",
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
