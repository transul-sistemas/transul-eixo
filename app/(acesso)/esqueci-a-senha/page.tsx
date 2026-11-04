import type { Metadata } from "next";
import { FormularioDeRecuperacao } from "../formularios";

export const metadata: Metadata = { title: "Esqueci a senha · TranSul Eixo" };

export default function PaginaDeRecuperacao() {
  return <FormularioDeRecuperacao />;
}
