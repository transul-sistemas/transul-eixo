// Início › Tarefas: transforma os números do banco (nucleo.tarefas_do_usuario, já com a RLS de quem
// consulta) na lista do que espera a ação da pessoa. Regra pura, sem tela: só decide o que vira
// tarefa, em que ordem e com que texto e destino. Quem conta e quem pode ver é o banco.

export interface NumerosDeTarefas {
  /** Pedidos de transferência abertos para quem consulta. */
  paraReceber: number;
  /** Todos os pedidos abertos que quem consulta pode ver (inclui os que são para ele). */
  pedidosAbertos: number;
  excecoes: { total: number; porAssunto: { assunto: string; n: number }[] };
  placasComAlerta: number;
  alertas: { alerta: string; n: number }[];
}

export interface Tarefa {
  id: string;
  quantidade: number;
  texto: string;
  href: string;
}

export const ROTA_DA_FILA = "/frota/excecoes";

/** Os assuntos que a fila conhece hoje: singular e plural do texto da tarefa e o nome do filtro. */
const ASSUNTOS: Record<string, { nome: string; um: string; varios: string }> = {
  cadastro_incompleto: {
    nome: "Cadastro incompleto",
    um: "placa com cadastro incompleto",
    varios: "placas com cadastro incompleto",
  },
  placa_com_dois_cr_do_mesmo_tipo: {
    nome: "Dois CRs do mesmo tipo",
    um: "placa com dois CRs do mesmo tipo",
    varios: "placas com dois CRs do mesmo tipo",
  },
  pessoa_sem_documento: {
    nome: "Pessoa sem documento",
    um: "pessoa sem documento",
    varios: "pessoas sem documento",
  },
  cr_sem_garagem: {
    nome: "CR sem garagem",
    um: "CR sem garagem",
    varios: "CRs sem garagem",
  },
  data_fora_de_faixa: {
    nome: "Data fora de faixa",
    um: "lançamento com data fora de faixa",
    varios: "lançamentos com data fora de faixa",
  },
  cr_frota_diverge_da_unidade: {
    nome: "CR de frota que diverge da unidade",
    um: "CR de frota que diverge da unidade",
    varios: "CRs de frota que divergem da unidade",
  },
};

export const ASSUNTOS_DA_FILA: readonly string[] = Object.keys(ASSUNTOS);

export function nomeDoAssunto(assunto: string): string {
  return ASSUNTOS[assunto]?.nome ?? "Outro tipo";
}

function contar(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function enderecoDaFila(e: { assunto: string | null; pagina: number }): string {
  const q = new URLSearchParams();
  if (e.assunto !== null) q.set("assunto", e.assunto);
  if (e.pagina > 1) q.set("pagina", String(e.pagina));
  const texto = q.toString();
  return texto ? `${ROTA_DA_FILA}?${texto}` : ROTA_DA_FILA;
}

/** A ordem: o que a pessoa recebe, os pedidos dos outros, as exceções (por quantidade) e os alertas. */
export function montarTarefas(numeros: NumerosDeTarefas): Tarefa[] {
  const tarefas: Tarefa[] = [];
  if (numeros.paraReceber > 0) {
    tarefas.push({
      id: "para-receber",
      quantidade: numeros.paraReceber,
      texto: contar(numeros.paraReceber, "placa para receber", "placas para receber"),
      href: "/frota/placas?chip=para_receber",
    });
  }
  const dosOutros = numeros.pedidosAbertos - numeros.paraReceber;
  if (dosOutros > 0) {
    tarefas.push({
      id: "pedidos-abertos",
      quantidade: dosOutros,
      texto: contar(
        dosOutros,
        "pedido de transferência aberto",
        "pedidos de transferência abertos",
      ),
      href: "/frota/placas",
    });
  }
  for (const { assunto, n } of numeros.excecoes.porAssunto) {
    if (n <= 0) continue;
    const textos = ASSUNTOS[assunto];
    tarefas.push({
      id: `excecao-${assunto}`,
      quantidade: n,
      texto: textos
        ? contar(n, textos.um, textos.varios)
        : contar(n, "exceção de outro tipo", "exceções de outros tipos"),
      href: enderecoDaFila({ assunto: textos ? assunto : null, pagina: 1 }),
    });
  }
  if (numeros.placasComAlerta > 0) {
    tarefas.push({
      id: "alertas",
      quantidade: numeros.placasComAlerta,
      texto: contar(numeros.placasComAlerta, "placa com alerta", "placas com alerta"),
      href: "/frota/placas",
    });
  }
  return tarefas;
}
