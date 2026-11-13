// Os tipos das leituras do gerenciador de processos (Nível 3), sem código do servidor: a tela importa só daqui.
// As telas Administração › Painel de processos e › Processos e responsáveis leem o contrato único do painel
// (painel-tipos.ts) por nucleo.painel_de_processos e nucleo.processos_e_responsaveis; o id da linha do Painel de
// processos é `processo:tarefa_id` (o que "Reatribuir tarefa" pede) e a opção `processos` de Processos e
// responsáveis leva `codigo:versao` (o que "Editar processo" pede).

/** nucleo.minhas_tarefas(): a caixa de quem chama (até 200, pelo prazo). */
export interface MinhasTarefas {
  total: number;
  vencidas: number;
  linhas: TarefaDaCaixa[];
}

export interface TarefaDaCaixa {
  processo: string;
  processo_nome: string;
  tarefa_id: string;
  assunto: string;
  descricao: string | null;
  /** minha (dono), delegada (de quem delegou a mim) ou fila (do meu perfil, sem dono). */
  origem: "minha" | "delegada" | "fila";
  /** Quem delegou, quando a origem é "delegada". */
  de: string | null;
  aberta_em: string;
  vence_em: string | null;
  vencida: boolean;
}

/** nucleo.delegacoes(p_so_vigentes): as delegações (substituições) de quem chama, ou todas para o Administrador. */
export interface Delegacoes {
  linhas: Delegacao[];
}

export interface Delegacao {
  id: string;
  versao: number;
  de_pessoa_id: string;
  de: string;
  para_pessoa_id: string;
  para: string;
  /** [início, fim): o fim é o dia em que a pessoa volta. */
  inicio: string;
  fim: string;
  /** Nulo = todos os processos. */
  processo: string | null;
  processo_nome: string | null;
  motivo: string;
  situacao: "vigente" | "futura" | "encerrada";
}

export type TipoDoPedidoDeAprovacao = "mes_fechado" | "permissao" | "outro";

/** nucleo.pedidos_de_aprovacao(p_situacao): os pedidos (os próprios; a Diretoria e o Administrador veem todos). */
export interface PedidosDeAprovacao {
  linhas: PedidoDeAprovacao[];
}

export interface PedidoDeAprovacao {
  id: string;
  versao: number;
  numero: number;
  tipo: TipoDoPedidoDeAprovacao;
  descricao: string;
  referencia: string | null;
  situacao: "pedido" | "aprovado" | "recusado";
  pedido_por: string;
  pedido_em: string;
  decidido_por: string | null;
  decidido_em: string | null;
  motivo_da_decisao: string | null;
}
