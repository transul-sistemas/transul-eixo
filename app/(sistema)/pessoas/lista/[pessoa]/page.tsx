import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { idValido } from "@/lib/navegacao/pessoas";
import type { ParametrosDaBusca } from "../pagina-de-pessoas";
import { FichaDaPessoaCarregando, FichaDaPessoaNaTela } from "./ficha-da-pessoa";

type Props = {
  params: Promise<{ pessoa: string }>;
  searchParams: ParametrosDaBusca;
};

// Como a ficha da operação: o id é conferido antes de transmitir (id mal escrito dá 404 de verdade),
// por isso a rota é dinâmica de ponta a ponta.
export const instant = false;

export const metadata: Metadata = { title: "Pessoa · TranSul Eixo" };

export default async function Pagina({ params, searchParams }: Props) {
  await connection();
  const { pessoa } = await params;
  if (!idValido(pessoa)) notFound();
  return (
    <Suspense fallback={<FichaDaPessoaCarregando />}>
      <FichaDaPessoaNaTela id={pessoa} searchParams={searchParams} />
    </Suspense>
  );
}
