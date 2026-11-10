import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { idDeOperacaoValido } from "@/lib/navegacao/operacoes";
import type { ParametrosDaBusca } from "../pagina-de-operacoes";
import { FichaDaOperacaoCarregando, FichaDaOperacaoNaTela } from "./ficha-da-operacao";

type Props = {
  params: Promise<{ operacao: string }>;
  searchParams: ParametrosDaBusca;
};

// Como a ficha da placa: o id é conferido antes de transmitir (id mal escrito dá 404 de verdade), por
// isso a rota é dinâmica de ponta a ponta.
export const instant = false;

export const metadata: Metadata = { title: "Operação · TranSul Eixo" };

export default async function Pagina({ params, searchParams }: Props) {
  await connection();
  const { operacao } = await params;
  if (!idDeOperacaoValido(operacao)) notFound();
  return (
    <Suspense fallback={<FichaDaOperacaoCarregando />}>
      <FichaDaOperacaoNaTela id={operacao} searchParams={searchParams} />
    </Suspense>
  );
}
