import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioDeEntrada } from "../formularios";

export const metadata: Metadata = { title: "Entrar · TranSul Eixo" };

export default function PaginaDeEntrar() {
  return (
    <Suspense>
      <FormularioDeEntrada />
    </Suspense>
  );
}
