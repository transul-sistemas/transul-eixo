"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  type ContextoGlobal,
  escreverContexto,
  lerContexto,
  OPCOES_PROVISORIAS,
  type OpcaoDoContexto,
  type OpcoesDoContexto,
  periodoValido,
} from "@/lib/navegacao/contexto";
import { type Perfil, USUARIO_PROVISORIO } from "@/lib/navegacao/perfis";
import { migalhas } from "@/lib/navegacao/trilha";
import { AlternadorDeTema } from "@/components/tema/alternador-de-tema";
import { BuscaRapida } from "./busca-rapida";
import { LinkComContexto } from "./link-com-contexto";

export interface PropsDoTopo {
  /** Dia de hoje em São Paulo, `aaaa-mm-dd`: é de onde vem o período padrão. */
  hoje: string;
  perfil: Perfil;
  /** De quem são os fixados e os recentes da busca rápida (provisório até haver login). */
  usuario?: string;
  /** Rota da página (padrão da navegação): a trilha e os links partem dela. */
  rota: string;
  /** Parâmetros da URL: o contexto e o `?modo=` são lidos daqui. */
  parametros?: URLSearchParams;
  opcoes?: OpcoesDoContexto;
  /** Chamado com a nova URL quando a pessoa muda o contexto. */
  aoNavegar?: (url: string) => void;
}

function Controle({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="border-input bg-card flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

function Escolha({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: string;
  opcoes: readonly OpcaoDoContexto[];
  aoMudar: (id: string) => void;
}) {
  return (
    <select
      value={valor}
      onChange={(evento) => aoMudar(evento.target.value)}
      className="text-foreground bg-transparent outline-none"
    >
      {opcoes.map((opcao) => (
        <option key={opcao.id} value={opcao.id}>
          {opcao.nome}
        </option>
      ))}
    </select>
  );
}

/**
 * Topo do sistema: a trilha da página, o contexto global (período, filial, operação e regime, na
 * URL) e o botão de tema. Sem rede nem estado próprio: tudo vem da URL.
 */
export function Topo({
  hoje,
  perfil,
  usuario = USUARIO_PROVISORIO,
  rota,
  parametros = new URLSearchParams(),
  opcoes = OPCOES_PROVISORIAS,
  aoNavegar,
}: PropsDoTopo) {
  const contexto = lerContexto(parametros, hoje, opcoes);
  const caminho = rota.split("?")[0] ?? rota;
  const trilha = migalhas(rota, perfil, parametros.get("modo"));

  function mudar(parcial: Partial<ContextoGlobal>) {
    const novos = escreverContexto(parametros, { ...contexto, ...parcial }, hoje, opcoes);
    const texto = novos.toString();
    aoNavegar?.(texto ? `${caminho}?${texto}` : caminho);
  }

  return (
    <header className="border-border bg-background sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-8 py-2">
      <nav aria-label="Trilha">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          {trilha.map((migalha, i) => (
            <li key={`${i}-${migalha.texto}`} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              ) : null}
              {migalha.atual ? (
                <span aria-current="page" className="font-medium">
                  {migalha.texto}
                </span>
              ) : migalha.href ? (
                <LinkComContexto
                  href={migalha.href}
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  {migalha.texto}
                </LinkComContexto>
              ) : (
                <span className="text-muted-foreground">{migalha.texto}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Contexto global"
          className="flex flex-wrap items-center gap-2"
        >
          <Controle rotulo="Período">
            <input
              type="month"
              value={contexto.periodo}
              min="2000-01"
              onChange={(evento) => {
                if (periodoValido(evento.target.value)) mudar({ periodo: evento.target.value });
              }}
              className="text-foreground bg-transparent tabular-nums outline-none"
            />
          </Controle>
          <Controle rotulo="Filial">
            <Escolha
              valor={contexto.filial}
              opcoes={opcoes.filiais}
              aoMudar={(filial) => mudar({ filial })}
            />
          </Controle>
          <Controle rotulo="Operação">
            <Escolha
              valor={contexto.operacao}
              opcoes={opcoes.operacoes}
              aoMudar={(operacao) => mudar({ operacao })}
            />
          </Controle>
          <Controle rotulo="Regime">
            <Escolha
              valor={contexto.regime}
              opcoes={opcoes.regimes}
              aoMudar={(regime) => mudar({ regime })}
            />
          </Controle>
        </div>
        <BuscaRapida
          perfil={perfil}
          usuario={usuario}
          rota={caminho}
          parametros={parametros}
          aoNavegar={aoNavegar}
        />
        <AlternadorDeTema />
      </div>
    </header>
  );
}

/** O topo ligado ao navegador: lê a rota e a URL e troca a URL quando o contexto muda. */
export function TopoLigado({ hoje, perfil }: Pick<PropsDoTopo, "hoje" | "perfil">) {
  const rota = usePathname();
  const lidos = useSearchParams();
  const router = useRouter();
  return (
    <Topo
      hoje={hoje}
      perfil={perfil}
      rota={rota}
      parametros={new URLSearchParams(lidos.toString())}
      aoNavegar={(url) => router.push(url)}
    />
  );
}
