"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Moeda } from "@/components/formato/moeda";
import {
  formatarInteiro,
  formatarKm,
  formatarKmPorLitro,
  formatarLitros,
} from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import type { LinhaDoAbastecimento } from "@/lib/dados/abastecimento-tipos";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import { CAMPOS_DO_ABASTECIMENTO, PADRAO_DO_ABASTECIMENTO } from "@/lib/navegacao/abastecimento";
import { lerTabela, mudarConsulta } from "@/lib/navegacao/tabela";

// A tabela do Abastecimento: uma linha por placa no mês. A ordem é do banco (o cabeçalho troca a
// ordem na URL); a placa do Eixo abre a ficha; a que veio só da v1 aparece sem link.

const SEM_VALOR = <span className="text-muted-foreground">—</span>;
const DIREITA = "text-right tabular-nums";

const COLUNAS: readonly ColunaDeTabela<LinhaDoAbastecimento>[] = [
  {
    id: "placa",
    titulo: "Placa",
    campoDeOrdem: "placa",
    cabecalhoDeLinha: true,
    celula: (l, { densidade }) =>
      l.ativoId ? (
        <Link
          href={`/frota/placas/${l.placa}`}
          aria-label={`Abrir a ficha da placa ${l.placa}`}
          className="focus-visible:ring-ring/50 inline-flex rounded outline-none focus-visible:ring-3"
        >
          <Placa placa={l.placa} tamanho={densidade === "compacta" ? "p" : "m"} />
        </Link>
      ) : (
        <span title="Placa da v1 que ainda não está no Eixo">
          <Placa placa={l.placa} tamanho={densidade === "compacta" ? "p" : "m"} />
        </span>
      ),
  },
  {
    id: "tipo",
    titulo: "Tipo",
    celula: (l) => (l.tipo ? (NOMES_DOS_TIPOS[l.tipo] ?? l.tipo) : SEM_VALOR),
  },
  { id: "modelo", titulo: "Modelo", celula: (l) => l.modelo ?? SEM_VALOR },
  {
    id: "abastecimentos",
    titulo: "Abastecimentos",
    campoDeOrdem: "abastecimentos",
    classe: DIREITA,
    celula: (l) => formatarInteiro(l.abastecimentos),
  },
  {
    id: "litros",
    titulo: "Litros",
    campoDeOrdem: "litros",
    classe: DIREITA,
    celula: (l) => formatarLitros(l.litros),
  },
  {
    id: "km",
    titulo: "Km rodado",
    campoDeOrdem: "km",
    classe: DIREITA,
    celula: (l) => formatarKm(l.km),
  },
  {
    id: "km_por_litro",
    titulo: "Km/l",
    campoDeOrdem: "km_por_litro",
    classe: DIREITA,
    celula: (l) => formatarKmPorLitro(l.kmPorLitro),
  },
  {
    id: "valor",
    titulo: "Valor",
    campoDeOrdem: "valor",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.valorCentavos} />,
  },
  {
    id: "sem_hodometro",
    titulo: "Sem hodômetro válido",
    classe: DIREITA,
    celula: (l) => (l.semHodometro > 0 ? formatarInteiro(l.semHodometro) : SEM_VALOR),
  },
];

export function TabelaDoAbastecimento({ linhas }: { linhas: readonly LinhaDoAbastecimento[] }) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const consulta = lerTabela(
    new URLSearchParams(parametros.toString()),
    PADRAO_DO_ABASTECIMENTO,
    CAMPOS_DO_ABASTECIMENTO,
  );

  function ordenarPor(campo: string) {
    const atual = consulta.ordem;
    const sentido = atual.campo === campo && atual.sentido === "asc" ? "desc" : "asc";
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      { ordem: { campo, sentido } },
      PADRAO_DO_ABASTECIMENTO,
      CAMPOS_DO_ABASTECIMENTO,
    ).toString();
    iniciar(() => router.push(novos ? `${rota}?${novos}` : rota, { scroll: false }));
  }

  return (
    <TabelaDeDados
      rotulo="Abastecimento por placa"
      colunas={COLUNAS}
      linhas={linhas}
      idDaLinha={(l) => l.placa}
      ordem={consulta.ordem}
      aoOrdenar={ordenarPor}
      pendente={pendente}
    />
  );
}
