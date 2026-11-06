import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { AreaPrincipal } from "@/components/navegacao/area-principal";
import { AvisoDeDispositivo } from "@/components/navegacao/aviso-de-dispositivo";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { TopoDoSistema, TopoReservado } from "@/components/navegacao/topo-do-sistema";
import { ArmadorDaVolta } from "@/components/tabela/retorno-da-lista-no-navegador";
import { exigirSessao, obterPessoaDaSessao } from "@/lib/seguranca/sessao-do-servidor";
import { sair } from "@/app/(acesso)/acoes";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { contarParaReceber } from "@/lib/dados/fonte";

/** O selo "para receber" nunca derruba a barra: sem o número, a barra aparece sem o selo. */
async function contarParaReceberSemCair(): Promise<number> {
  try {
    await connection();
    return await contarParaReceber(hojeEmSaoPaulo(new Date()));
  } catch (erro) {
    console.error("contagem de placas para receber indisponível:", erro);
    return 0;
  }
}

// A barra lateral mostra só os módulos do perfil da sessão (lido do banco a cada pedido). Ler a sessão
// é dinâmico, então ela fica num Suspense, com o lugar reservado (a largura padrão, aberta).
async function BarraLateralDaSessao() {
  // A sessão e a pessoa em paralelo: a barra chega mais cedo.
  const [{ perfil, usuarioId, email }, pessoa, paraReceber] = await Promise.all([
    exigirSessao(),
    obterPessoaDaSessao(),
    contarParaReceberSemCair(),
  ]);
  // A memória da barra é de quem entrou (fatia 3.9a); nome e e-mail no rodapé, acima do Sair. O selo
  // de Placas conta o que espera por quem usa (o total vem do banco).
  return (
    <BarraLateral
      perfil={perfil}
      usuario={usuarioId}
      contadores={paraReceber > 0 ? { "frota.placas": paraReceber } : {}}
      aoSair={sair}
      quem={{ nome: pessoa?.nome ?? email ?? "Sem nome", email }}
    />
  );
}

function BarraLateralReservada() {
  return (
    <div
      aria-hidden
      data-barra-reservada=""
      className="border-border bg-sidebar shrink-0 max-lg:hidden lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-r"
    />
  );
}

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
      <ArmadorDaVolta />
      <Suspense fallback={<BarraLateralReservada />}>
        <BarraLateralDaSessao />
      </Suspense>
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
