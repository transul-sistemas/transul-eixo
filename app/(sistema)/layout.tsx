import { type ReactNode, Suspense } from "react";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { TopoDoSistema, TopoReservado } from "@/components/navegacao/topo-do-sistema";
import { perfilAtual, USUARIO_PROVISORIO } from "@/lib/navegacao/perfis";

export default function LayoutDoSistema({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      <a
        href="#conteudo"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring/50 sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      <BarraLateral perfil={perfilAtual()} usuario={USUARIO_PROVISORIO} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<TopoReservado />}>
          <TopoDoSistema />
        </Suspense>
        <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
