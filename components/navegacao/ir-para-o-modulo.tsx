import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { IdDoModulo } from "@/lib/navegacao/catalogo";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { destinoDoModulo } from "@/lib/navegacao/redirecionar";

type ParametrosDaPagina = Promise<Record<string, string | string[] | undefined>>;

async function Destino({
  modulo,
  searchParams,
}: {
  modulo: IdDoModulo;
  searchParams: ParametrosDaPagina;
}): Promise<never> {
  const lidos = await searchParams;
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(lidos)) {
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      if (item !== undefined) parametros.append(chave, item);
    }
  }
  const { perfil } = await exigirSessao();
  const destino = destinoDoModulo(perfil, modulo, parametros);
  if (!destino) notFound();
  redirect(destino);
}

/** Página de um módulo (/frota, /pessoas...): leva à primeira tela visível ao perfil, ou 404. */
export function IrParaOModulo(props: { modulo: IdDoModulo; searchParams: ParametrosDaPagina }) {
  return (
    <Suspense fallback={null}>
      <Destino {...props} />
    </Suspense>
  );
}
