import { IconChevronRight } from "@tabler/icons-react";
import { enderecoDoCsv } from "@/lib/navegacao/exportacao";
import Link from "next/link";
import { connection } from "next/server";
import { formatarInteiro } from "@/components/formato/numero";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { lerPedidosDeBaixa, type PedidoDeBaixa } from "@/lib/dados/baixa";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { modoDosDados } from "@/lib/dados/fonte";
import { textoDoErro } from "@/lib/log/erro";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { lerPedidosDeAprovacao, type PedidoDeAprovacao } from "@/lib/dados/aprovacao";
import {
  type GestorComPosicaoPendente,
  lerGestoresComPosicaoPendente,
} from "@/lib/dados/posicao-do-dia";
import { BaixasPedidas } from "./baixas-pedidas";
import { PedidosDeAprovacao } from "./pedidos-de-aprovacao";
import { PosicaoDosGestores } from "./posicao-dos-gestores";
import { lerTarefas } from "@/lib/dados/tarefas";
import { montarTarefas } from "@/lib/dominio/tarefas";
import { acharTela } from "@/lib/navegacao/catalogo";

// Início › Tarefas (primeira versão): o que espera a ação de quem entrou. Os números vêm do banco, já com
// a RLS de cada perfil (nucleo.tarefas_do_usuario): o Administrador e a Diretoria veem o panorama; o
// Gestor de frota, só o que é da sua carteira. Cada tarefa leva à tela que resolve.

function cabecalho() {
  const tela = acharTela("/inicio/tarefas")?.tela;
  return { titulo: tela?.nome ?? "Tarefas", descricao: tela?.descricao };
}

export function PaginaDasTarefasCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela linhas={4} rotulo="Carregando as tarefas" />
    </PaginaDeLeitura>
  );
}

async function Conteudo() {
  const tarefas = montarTarefas(await lerTarefas());
  if (tarefas.length === 0) {
    return (
      <ListaVazia
        titulo="Nada espera você agora"
        descricao="Quando uma placa for disponibilizada para você, ou uma exceção pedir o seu dado, ela aparece aqui."
      />
    );
  }
  return (
    <ul
      aria-label="Tarefas"
      className="border-border bg-card divide-border divide-y rounded-xl border"
    >
      {tarefas.map((t) => (
        <li key={t.id}>
          <Link
            href={t.href}
            className="hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-4 px-4 py-3 outline-none first:rounded-t-xl last:rounded-b-xl focus-visible:ring-3"
          >
            <span
              className="bg-primary text-primary-foreground inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums"
              aria-hidden
            >
              {formatarInteiro(t.quantidade)}
            </span>
            <span className="flex-1 text-sm font-medium">{t.texto}</span>
            <IconChevronRight aria-hidden className="text-muted-foreground size-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** S4: os pedidos de baixa abertos (a Diretoria decide; quem pediu cancela). Falha vira aviso. */
async function Baixas() {
  const { perfil, usuarioId } = await exigirSessao();
  let pedidos: PedidoDeBaixa[] | null = null;
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    pedidos = await lerPedidosDeBaixa(cliente, "pedida");
  } catch (erro) {
    console.error("pedidos de baixa indisponíveis:", textoDoErro(erro));
  }
  if (pedidos === null) {
    return (
      <p role="alert" className="border-border rounded-lg border p-3 text-sm">
        Não foi possível ler os pedidos de baixa agora. Recarregue a página para tentar de novo.
      </p>
    );
  }
  return (
    <ProvedorDoUsuario usuario={usuarioId}>
      <BaixasPedidas
        pedidos={pedidos}
        podeDecidir={perfil === "Diretoria"}
        podeCancelar={perfil === "Gestor de frota"}
      />
    </ProvedorDoUsuario>
  );
}

/** 31: os gestores das operações de quem é líder, com a Posição do dia (vazio para quem não é líder). */
async function DoLider() {
  const { usuarioId } = await exigirSessao();
  let dia: string | null = null;
  let gestores: GestorComPosicaoPendente[] = [];
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    const r = await cliente
      .schema("nucleo")
      .rpc("dia_da_posicao", { p_em: new Date().toISOString() });
    if (r.error) throw new Error(`dia_da_posicao: ${r.error.message}`);
    dia = String(r.data);
    gestores = await lerGestoresComPosicaoPendente(cliente, dia);
  } catch (erro) {
    console.error("posição dos gestores indisponível:", textoDoErro(erro));
    return (
      <p role="alert" className="border-border rounded-lg border p-3 text-sm">
        Não foi possível ler a Posição do dia dos seus gestores. Recarregue a página para tentar de
        novo.
      </p>
    );
  }
  if (!dia || gestores.length === 0) return null;
  return (
    <ProvedorDoUsuario usuario={usuarioId}>
      <PosicaoDosGestores gestores={gestores} dia={dia} />
    </ProvedorDoUsuario>
  );
}

/** 37: os pedidos de aprovação (os próprios; a Diretoria e o Administrador veem todos). */
async function Aprovacoes() {
  const { perfil, usuarioId } = await exigirSessao();
  let pedidos: PedidoDeAprovacao[] | null = null;
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    pedidos = await lerPedidosDeAprovacao(cliente, null);
  } catch (erro) {
    console.error("pedidos de aprovação indisponíveis:", textoDoErro(erro));
  }
  if (pedidos === null) {
    return (
      <p role="alert" className="border-border rounded-lg border p-3 text-sm">
        Não foi possível ler os pedidos de aprovação agora. Recarregue a página para tentar de novo.
      </p>
    );
  }
  return (
    <ProvedorDoUsuario usuario={usuarioId}>
      <PedidosDeAprovacao pedidos={pedidos} podeDecidir={perfil === "Diretoria"} />
    </ProvedorDoUsuario>
  );
}

export async function PaginaDasTarefas() {
  await connection();
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      exportar={enderecoDoCsv("inicio.tarefas")}
    >
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="As Tarefas leem só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver o que espera você."
        />
      ) : (
        <>
          <Conteudo />
          <DoLider />
          <Baixas />
          <Aprovacoes />
        </>
      )}
    </PaginaDeLeitura>
  );
}
