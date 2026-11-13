import { textoDoErro } from "@/lib/log/erro";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { AreaPrincipal } from "@/components/navegacao/area-principal";
import { AvisoDeDispositivo } from "@/components/navegacao/aviso-de-dispositivo";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { FaixaDaDemonstracaoDaSessao } from "@/components/navegacao/faixa-da-demonstracao";
import { TopoDoSistema, TopoReservado } from "@/components/navegacao/topo-do-sistema";
import { ArmadorDaVolta } from "@/components/tabela/retorno-da-lista-no-navegador";
import { bancoEmDemonstracao } from "@/lib/dados/faixa-da-demonstracao";
import { exigirSessao, obterPessoaDaSessao } from "@/lib/seguranca/sessao-do-servidor";
import { sair } from "@/app/(acesso)/acoes";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { contarParaReceber } from "@/lib/dados/fonte";

/**
 * O selo "para receber" nunca derruba a barra: sem o número, a barra aparece sem o selo. A leitura é
 * dinâmica (depois do `connection()`, dentro do Suspense da barra); a interrupção do pré-render e os
 * desvios do Next não são erro e seguem para ele (`unstable_rethrow`), senão o pré-render da casca
 * registraria uma falha falsa a cada rota.
 */
async function contarParaReceberSemCair(): Promise<number> {
  await connection();
  try {
    return await contarParaReceber(hojeEmSaoPaulo(new Date()));
  } catch (erro) {
    unstable_rethrow(erro);
    console.error("contagem de placas para receber indisponível:", textoDoErro(erro));
    return 0;
  }
}

// A barra lateral mostra só os módulos do perfil da sessão (lido do banco a cada pedido). Ler a sessão
// é dinâmico, então ela fica num Suspense, com o lugar reservado (a largura padrão, aberta).
async function BarraLateralDaSessao() {
  // A sessão e a pessoa em paralelo: a barra chega mais cedo.
  const [{ perfil, usuarioId, email }, pessoa, paraReceber, emDemonstracao] = await Promise.all([
    exigirSessao(),
    obterPessoaDaSessao(),
    contarParaReceberSemCair(),
    bancoEmDemonstracao(),
  ]);
  // A memória da barra é de quem entrou (fatia 3.9a); nome e e-mail no rodapé, acima do Sair. O selo
  // de Placas conta o que espera por quem usa (o total vem do banco).
  return (
    <BarraLateral
      perfil={perfil}
      emDemonstracao={emDemonstracao}
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
      className="border-border bg-sidebar shrink-0 group-has-[[data-grade-fixa]]/casca:max-[1439px]:hidden max-lg:hidden lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-r"
    />
  );
}

// A página rola sozinha (o menu e o topo ficam fixos). O modo foco, que esconde menu e topo para a tabela
// ocupar a tela, e a grade do Acompanhamento (`data-grade-fixa`: a página nunca rola na vertical e, abaixo de
// 1440 px, a barra lateral recolhe sozinha) travam a altura na da janela: aí a tabela é o que rola.
export default function LayoutDoSistema({ children }: { children: ReactNode }) {
  return (
    <div className="group/casca flex min-h-screen flex-1 has-[[data-grade-fixa]]:h-dvh has-[[data-grade-fixa]]:min-h-0 has-[[data-grade-fixa]]:flex-none has-[[data-grade-fixa]]:overflow-hidden has-[[data-modo-foco]]:h-dvh has-[[data-modo-foco]]:min-h-0 has-[[data-modo-foco]]:flex-none has-[[data-modo-foco]]:overflow-hidden">
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
        <Suspense fallback={null}>
          <FaixaDaDemonstracaoDaSessao />
        </Suspense>
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
