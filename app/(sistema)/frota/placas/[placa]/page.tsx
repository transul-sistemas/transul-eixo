import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { placaNormalizadaValida } from "@/lib/dominio/placa";
import type { ParametrosDaBusca } from "../pagina-de-placas";
import { FichaDaPlaca, FichaDaPlacaCarregando } from "./ficha-da-placa";

type Props = {
  params: Promise<{ placa: string }>;
  searchParams: ParametrosDaBusca;
};

// A ficha confere o formato da placa antes de transmitir, para devolver 404 de verdade a placa mal
// escrita; por isso o casco da rota depende da URL e a validação de navegação instantânea (só em
// desenvolvimento, nunca bloqueia o build) fica desligada aqui.
export const instant = false;

/** Uma placa de amostra, para a rota ter o casco pré-montado; as outras são resolvidas na hora. */
export function generateStaticParams() {
  return [{ placa: "AAA0A00" }];
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { placa } = await params;
  return { title: `${placaNormalizadaValida(placa) ? placa : "Placa"} · TranSul Eixo` };
}

export default async function Pagina({ params, searchParams }: Props) {
  const { placa } = await params;
  // Placa mal escrita (minúscula, hífen, tamanho errado, HTML) dá 404, antes de qualquer consulta.
  if (!placaNormalizadaValida(placa)) notFound();
  return (
    <Suspense fallback={<FichaDaPlacaCarregando placa={placa} />}>
      <FichaDaPlaca placa={placa} searchParams={searchParams} />
    </Suspense>
  );
}
