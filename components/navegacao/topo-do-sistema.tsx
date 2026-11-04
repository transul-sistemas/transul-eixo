import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { SinalDeHidratacao } from "@/components/tabela/sinal-de-hidratacao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { TopoLigado } from "./topo";

/**
 * Topo do sistema para o layout. O período padrão é o mês de hoje, e a data de hoje só existe na
 * hora do pedido, então este trecho (e só ele) é calculado a cada acesso.
 */
export async function TopoDoSistema() {
  await connection();
  const { perfil } = await exigirSessao();
  return (
    <>
      <TopoLigado hoje={hojeEmSaoPaulo(new Date())} perfil={perfil} />
      <SinalDeHidratacao regiao="topo" />
    </>
  );
}

/**
 * Reserva o lugar do topo enquanto ele é calculado, para a página não pular. O topo real quebra em
 * mais linhas conforme a largura (a trilha e o contexto global disputam a linha), então a altura
 * reservada acompanha a do topo real da lista de placas em cada faixa de largura, com a barra
 * lateral aberta (o padrão). Há teste que mede o topo real contra esta reserva (e2e/topo-reservado):
 * se o contexto mudar (outras opções, mais controles), a medida muda e o teste avisa.
 */
const ALTURA_RESERVADA_DO_TOPO = [
  "h-[3.9375rem]", // até 383 px: 63 px
  "min-[384px]:h-[3.5625rem]", // 57 px
  "min-[1024px]:h-[10.5625rem]", // 169 px
  "min-[1152px]:h-[7.8125rem]", // 125 px
  "min-[1304px]:h-[7.5625rem]", // 121 px
  "min-[1352px]:h-[5.0625rem]", // 81 px
  "min-[1464px]:h-[3.3125rem]", // 53 px
].join(" ");

export function TopoReservado() {
  return (
    <div
      aria-hidden
      data-topo-reservado=""
      className={`border-border shrink-0 border-b ${ALTURA_RESERVADA_DO_TOPO}`}
    />
  );
}
