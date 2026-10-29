import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { perfilAtual } from "@/lib/navegacao/perfis";
import { TopoLigado } from "./topo";

/**
 * Topo do sistema para o layout. O período padrão é o mês de hoje, e a data de hoje só existe na
 * hora do pedido, então este trecho (e só ele) é calculado a cada acesso.
 */
export async function TopoDoSistema() {
  await connection();
  return <TopoLigado hoje={hojeEmSaoPaulo(new Date())} perfil={perfilAtual()} />;
}

/** Reserva o lugar do topo enquanto ele é calculado, para a página não pular. */
export function TopoReservado() {
  return <div aria-hidden className="border-border h-[3.25rem] shrink-0 border-b" />;
}
