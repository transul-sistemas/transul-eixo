import { type ReactNode, Suspense } from "react";
import { AreaPrincipal } from "@/components/navegacao/area-principal";
import { AvisoDeDispositivo } from "@/components/navegacao/aviso-de-dispositivo";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { TopoDoSistema, TopoReservado } from "@/components/navegacao/topo-do-sistema";
import { perfilAtual, USUARIO_PROVISORIO } from "@/lib/navegacao/perfis";

// Telas de lista: a partir de 1024 px de largura e 640 px de altura a página tem a altura da janela e
// só a tabela rola. Em janela baixa, a página rola como as outras (senão a tabela some).
export default function LayoutDoSistema({ children }: { children: ReactNode }) {
  return (
    <div className="group/casca flex min-h-screen flex-1 [@media(min-width:1024px)_and_(min-height:640px)]:has-[[data-tela-de-lista]]:h-dvh [@media(min-width:1024px)_and_(min-height:640px)]:has-[[data-tela-de-lista]]:min-h-0 [@media(min-width:1024px)_and_(min-height:640px)]:has-[[data-tela-de-lista]]:flex-none [@media(min-width:1024px)_and_(min-height:640px)]:has-[[data-tela-de-lista]]:overflow-hidden">
      <a
        href="#conteudo"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring/50 sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      <BarraLateral perfil={perfilAtual()} usuario={USUARIO_PROVISORIO} />
      <AreaPrincipal>
        <Suspense fallback={<TopoReservado />}>
          <TopoDoSistema />
        </Suspense>
        <AvisoDeDispositivo />
        <main id="conteudo" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
          {children}
        </main>
      </AreaPrincipal>
    </div>
  );
}
