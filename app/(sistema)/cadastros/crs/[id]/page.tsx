import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FichaDoCr, FichaDoCrCarregando } from "./ficha-do-cr";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Como a ficha da operação: o id é conferido antes de transmitir (id mal escrito dá 404 de verdade), por
// isso a rota é dinâmica de ponta a ponta.
export const instant = false;

export const metadata: Metadata = { title: "CR · TranSul Eixo" };

export default async function Pagina({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return (
    <Suspense fallback={<FichaDoCrCarregando />}>
      <FichaDoCr id={id} />
    </Suspense>
  );
}
