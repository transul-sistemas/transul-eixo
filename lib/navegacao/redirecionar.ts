import { notFound, redirect } from "next/navigation";
import type { IdDoModulo } from "./catalogo";
import { perfilAtual } from "./perfis";
import { rotaInicialDoModulo } from "./visibilidade";

/** Página de um módulo (/frota, /pessoas...): leva à primeira tela visível ao perfil, ou 404. */
export function irParaOModulo(modulo: IdDoModulo): never {
  const rota = rotaInicialDoModulo(perfilAtual(), modulo);
  if (!rota) notFound();
  redirect(rota);
}
