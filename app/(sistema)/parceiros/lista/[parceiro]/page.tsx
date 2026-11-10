import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { idValido } from "@/lib/navegacao/parceiros";
import type { ParametrosDaBusca } from "../pagina-de-parceiros";
import { FichaDoParceiroCarregando, FichaDoParceiroNaTela } from "./ficha-do-parceiro";

type Props = {
  params: Promise<{ parceiro: string }>;
  searchParams: ParametrosDaBusca;
};

// O id é conferido antes de transmitir (id mal escrito dá 404 de verdade).
export const instant = false;

export const metadata: Metadata = { title: "Parceiro · TranSul Eixo" };

export default async function Pagina({ params, searchParams }: Props) {
  await connection();
  const { parceiro } = await params;
  if (!idValido(parceiro)) notFound();
  return (
    <Suspense fallback={<FichaDoParceiroCarregando />}>
      <FichaDoParceiroNaTela id={parceiro} searchParams={searchParams} />
    </Suspense>
  );
}
