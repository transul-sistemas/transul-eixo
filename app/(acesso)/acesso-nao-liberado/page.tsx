import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { sair } from "../acoes";

export const metadata: Metadata = { title: "Acesso não liberado · TranSul Eixo" };

// Quem entrou mas ainda não tem vínculo ativo no Eixo (o usuário existe no Auth, sem Pessoa ligada,
// ou com o vínculo desligado). O proxy só deixa esta tela e a de senha nova.
export default function PaginaDeAcessoNaoLiberado() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Acesso não liberado</h1>
      <p className="text-sm">Seu acesso ainda não foi liberado. Fale com o administrador.</p>
      <form action={sair}>
        <Button type="submit" variant="outline" className="h-10 w-full">
          Sair
        </Button>
      </form>
    </div>
  );
}
