import { redirect } from "next/navigation";

// A primeira tela do sistema é Início › Tarefas.
export default function Raiz() {
  redirect("/inicio/tarefas");
}
