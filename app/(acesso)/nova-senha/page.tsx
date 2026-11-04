import type { Metadata } from "next";
import { FormularioDeNovaSenha } from "../formularios";

export const metadata: Metadata = { title: "Senha nova · TranSul Eixo" };

// Chega-se aqui pelo link do e-mail (a confirmação cria a sessão); sem sessão, o proxy manda a /entrar.
export default function PaginaDeNovaSenha() {
  return <FormularioDeNovaSenha />;
}
