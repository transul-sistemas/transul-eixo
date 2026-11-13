import { notFound } from "next/navigation";
import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { EsqueletoDaTabela } from "@/components/tabela/estados";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { bancoEmDemonstracao } from "@/lib/dados/faixa-da-demonstracao";
import { fonteDeEscrita, modoDosDados } from "@/lib/dados/fonte";
import { lerPedidosAbertosDoMeuDia, lerPedidosDoMeuDia } from "@/lib/dados/meu-dia";
import { lerTarefas } from "@/lib/dados/tarefas";
import { podeDecidirNoLote } from "@/lib/dominio/meu-dia";
import { montarTarefas, type Tarefa } from "@/lib/dominio/tarefas";
import { acharTela } from "@/lib/navegacao/catalogo";
import { podeAbrir } from "@/lib/navegacao/visibilidade";
import { gestorAtual } from "@/lib/seguranca/gestor-atual";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { textoDoErro } from "@/lib/log/erro";
import { FilaDoDia } from "./fila-do-dia";

// Início › Meu dia (tela em teste, só do Administrador): a fila guiada do dia do gestor de frota. O
// primeiro passo, Receber placas, abre sozinho em popup central. Os pedidos vêm de
// nucleo.pedidos_para_receber (RLS: só o que espera o login de quem entrou); as outras tarefas, da caixa
// de Tarefas. Nada aqui grava por conta própria: a escrita é das funções atômicas que já existem.

function cabecalho() {
  const tela = acharTela("/inicio/meu-dia")?.tela;
  return { titulo: tela?.nome ?? "Meu dia", descricao: tela?.descricao };
}

export function PaginaDoMeuDiaCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela linhas={3} rotulo="Carregando o seu dia" />
    </PaginaDeLeitura>
  );
}

/** As outras tarefas da caixa (menos o que o lote já trata): só no banco; falha vira aviso, não queda. */
async function outrasTarefas(): Promise<{ tarefas: Tarefa[]; indisponivel: boolean }> {
  if (modoDosDados() !== "banco") return { tarefas: [], indisponivel: false };
  try {
    const todas = montarTarefas(await lerTarefas());
    return { tarefas: todas.filter((t) => t.id !== "para-receber"), indisponivel: false };
  } catch (erro) {
    console.error("meu dia: tarefas indisponíveis:", textoDoErro(erro));
    return { tarefas: [], indisponivel: true };
  }
}

export async function PaginaDoMeuDia() {
  await connection();
  const { perfil, usuarioId } = await exigirSessao();
  // Além do proxy (que já responde 404): o Administrador abre sempre; o Gestor de frota, só com o
  // parâmetro banco_em_demonstracao ligado (lido com a chave de quem chama).
  const telaDoMeuDia = acharTela("/inicio/meu-dia")?.tela;
  if (!telaDoMeuDia || !podeAbrir(perfil, telaDoMeuDia, await bancoEmDemonstracao())) {
    notFound();
  }
  // Só o gestor de destino decide; o Administrador vê a fila e os dados em modo leitura.
  const somenteLeitura = !podeDecidirNoLote(perfil);
  const { titulo, descricao } = cabecalho();
  const hoje = hojeEmSaoPaulo(new Date());

  let gestorId: string | null = null;
  try {
    gestorId = await gestorAtual();
  } catch {
    gestorId = null; // login sem pessoa ligada: não tem carteira, então nada a receber
  }
  const [linhas, outras] = await Promise.all([
    gestorId === null && !somenteLeitura
      ? Promise.resolve([])
      : fonteDeEscrita(hoje).then((fonte) =>
          lerPedidosDoMeuDia(
            fonte,
            gestorId ?? "",
            hoje,
            modoDosDados() === "banco"
              ? async () => {
                  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
                  const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
                  return lerPedidosAbertosDoMeuDia(cliente, somenteLeitura);
                }
              : undefined,
          ),
        ),
    outrasTarefas(),
  ]);

  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      acoes={
        <span
          title="Tela em teste: visível ao Administrador e, com o banco em demonstração, ao gestor de frota"
          className="text-muted-foreground border-border rounded-md border px-2 py-0.5 text-sm"
        >
          Teste
        </span>
      }
    >
      <ProvedorDoUsuario usuario={usuarioId}>
        <FilaDoDia
          linhas={linhas}
          semCarteira={gestorId === null}
          hoje={hoje}
          somenteLeitura={somenteLeitura}
          outras={outras.tarefas}
          outrasIndisponiveis={outras.indisponivel}
        />
      </ProvedorDoUsuario>
    </PaginaDeLeitura>
  );
}
