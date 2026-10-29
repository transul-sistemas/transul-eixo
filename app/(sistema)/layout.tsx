import type { ReactNode } from "react";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { perfilAtual, USUARIO_PROVISORIO } from "@/lib/navegacao/perfis";

export default function LayoutDoSistema({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      <BarraLateral perfil={perfilAtual()} usuario={USUARIO_PROVISORIO} />
      <main id="conteudo" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
