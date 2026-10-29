import { IconPlus, IconSearch, IconTrash, IconTruck } from "@tabler/icons-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import {
  formatarKm,
  formatarKmPorLitro,
  formatarLitros,
  formatarPercentual,
} from "@/components/formato/numero";
import { AssinaturaTranSul } from "@/components/marca/assinatura-transul";
import { Logotipo } from "@/components/marca/logotipo";
import { Placa } from "@/components/placa";
import { BarraLateral } from "@/components/navegacao/barra-lateral";
import { AlternadorDeTema } from "@/components/tema/alternador-de-tema";
import { Button } from "@/components/ui/button";
import { MODULOS, STATUS, type Modulo, type Status } from "@/lib/visual/tons";
import { CampoDeExemplo } from "./campo-de-exemplo";

export const metadata: Metadata = { title: "Base visual do Eixo · TranSul Eixo" };

const NOME_DO_MODULO: Record<Modulo, string> = {
  frota: "Frota",
  operacional: "Operacional",
  operacoes: "Operações",
  pessoas: "Pessoas",
  parceiros: "Parceiros",
  resultados: "Resultados",
  cadastros: "Cadastros",
  admin: "Administração",
};

// Texto curto da etiqueta; o nome completo vai no tooltip.
const ETIQUETA_DO_MODULO: Partial<Record<Modulo, string>> = { admin: "Admin" };

const NOME_DO_STATUS: Record<Status, string> = {
  "em-atividade": "Em atividade",
  atencao: "Atenção",
  impedida: "Impedida",
  patio: "Pátio",
  fora: "Fora",
};

// Classes escritas por extenso para o Tailwind encontrá-las: forte (faixa e bolinha) e suave (fundo).
const CLASSE_DO_MODULO: Record<Modulo, { forte: string; suave: string }> = {
  frota: { forte: "bg-modulo-frota", suave: "bg-modulo-frota-suave" },
  operacional: { forte: "bg-modulo-operacional", suave: "bg-modulo-operacional-suave" },
  operacoes: { forte: "bg-modulo-operacoes", suave: "bg-modulo-operacoes-suave" },
  pessoas: { forte: "bg-modulo-pessoas", suave: "bg-modulo-pessoas-suave" },
  parceiros: { forte: "bg-modulo-parceiros", suave: "bg-modulo-parceiros-suave" },
  resultados: { forte: "bg-modulo-resultados", suave: "bg-modulo-resultados-suave" },
  cadastros: { forte: "bg-modulo-cadastros", suave: "bg-modulo-cadastros-suave" },
  admin: { forte: "bg-modulo-cadastros", suave: "bg-modulo-cadastros-suave" },
};

const CLASSE_DO_STATUS: Record<Status, { forte: string; suave: string }> = {
  "em-atividade": { forte: "bg-status-em-atividade", suave: "bg-status-em-atividade-suave" },
  atencao: { forte: "bg-status-atencao", suave: "bg-status-atencao-suave" },
  impedida: { forte: "bg-status-impedida", suave: "bg-status-impedida-suave" },
  patio: { forte: "bg-status-patio", suave: "bg-status-patio-suave" },
  fora: { forte: "bg-status-fora", suave: "bg-status-fora-suave" },
};

// Contadores só da demonstração: o sistema ainda não tem de onde tirar tarefas ou casos.
const CONTADORES_DE_EXEMPLO = {
  "frota.placas": 3,
  "frota.carteira": 2,
  "operacional.patio": 12,
  "pessoas.status-diario": 120,
};

function Secao({
  titulo,
  explicacao,
  children,
}: {
  titulo: string;
  explicacao?: string;
  children: ReactNode;
}) {
  const id = `secao-${titulo.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section aria-labelledby={id} className="border-border flex flex-col gap-4 border-t pt-5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {titulo}
        </h2>
        {explicacao ? (
          <p className="text-muted-foreground max-w-[62ch] text-sm">{explicacao}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Amostra({ nome, forte, suave }: { nome: string; forte: string; suave: string }) {
  return (
    <li className="border-border bg-card overflow-hidden rounded-lg border">
      <div className={`h-2.5 ${forte}`} />
      <div className={`flex items-center gap-2 px-3 py-2.5 text-sm ${suave}`}>
        <span aria-hidden className={`size-2 rounded-full ${forte}`} />
        {nome}
      </div>
    </li>
  );
}

export default function Demonstracao() {
  return (
    <div className="flex w-full flex-col gap-8 px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-6">
        <Logotipo />
        <AlternadorDeTema />
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Base visual do Eixo</h1>
        <p className="text-muted-foreground max-w-[62ch]">
          Cada peça desta página é o componente real do sistema. Alterne o tema para conferir as
          cores nos dois modos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2 2xl:grid-cols-3">
        <Secao
          titulo="Azul de ação e azul da Frota"
          explicacao="Os dois azuis precisam ser distintos: o botão de ação aparece em toda tela, e o azul da Frota diz em que módulo a pessoa está."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">
              <IconPlus data-icon="inline-start" />
              Receber placa
            </Button>
            <Button size="lg" className="bg-modulo-frota text-acao-texto hover:bg-modulo-frota/85">
              <IconTruck data-icon="inline-start" />
              Receber placa (Frota)
            </Button>
          </div>
        </Secao>

        <Secao
          titulo="Módulos"
          explicacao="Faixa forte em cima, fundo suave embaixo. O Início usa o azul de ação."
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Amostra nome="Início" forte="bg-acao" suave="bg-card" />
            {MODULOS.map((modulo) => (
              <Amostra
                key={modulo}
                nome={NOME_DO_MODULO[modulo]}
                forte={CLASSE_DO_MODULO[modulo].forte}
                suave={CLASSE_DO_MODULO[modulo].suave}
              />
            ))}
          </ul>
        </Secao>

        <Secao
          titulo="Status da placa"
          explicacao="A cor de status diz como a placa está. Nunca é usada como cor de módulo."
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
            {STATUS.map((status) => (
              <Amostra
                key={status}
                nome={NOME_DO_STATUS[status]}
                forte={CLASSE_DO_STATUS[status].forte}
                suave={CLASSE_DO_STATUS[status].suave}
              />
            ))}
          </ul>
        </Secao>

        <Secao
          titulo="Etiquetas"
          explicacao="Fundo suave, bolinha na cor forte e texto na cor do texto."
        >
          <div className="flex flex-wrap gap-2">
            {MODULOS.map((modulo) => (
              <Etiqueta key={modulo} modulo={modulo} titulo={NOME_DO_MODULO[modulo]}>
                {ETIQUETA_DO_MODULO[modulo] ?? NOME_DO_MODULO[modulo]}
              </Etiqueta>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS.map((status) => (
              <Etiqueta key={status} status={status}>
                {NOME_DO_STATUS[status]}
              </Etiqueta>
            ))}
          </div>
        </Secao>

        <Secao
          titulo="Bolinhas sobre a superfície"
          explicacao="A cor forte aparece sozinha como bolinha. Confira se cada uma se destaca no tema escuro, principalmente a da Frota."
        >
          <div className="border-border bg-card flex flex-wrap items-center gap-4 rounded-lg border p-4">
            {MODULOS.map((modulo) => (
              <span
                key={modulo}
                title={NOME_DO_MODULO[modulo]}
                className={`size-5 rounded-full ${CLASSE_DO_MODULO[modulo].forte}`}
              />
            ))}
            <span aria-hidden className="bg-border mx-1 h-5 w-px" />
            {STATUS.map((status) => (
              <span
                key={status}
                title={NOME_DO_STATUS[status]}
                className={`size-5 rounded-full ${CLASSE_DO_STATUS[status].forte}`}
              />
            ))}
          </div>
        </Secao>

        <Secao titulo="Botões" explicacao="Verbo mais objeto, com ícone Tabler quando ajuda.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <IconPlus data-icon="inline-start" />
              Receber placa
            </Button>
            <Button variant="outline">
              <IconSearch data-icon="inline-start" />
              Buscar placa
            </Button>
            <Button variant="secondary">Filtrar placas</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="destructive">
              <IconTrash data-icon="inline-start" />
              Excluir placa
            </Button>
            <Button disabled>Salvar rascunho</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">Extra pequeno</Button>
            <Button size="sm">Pequeno</Button>
            <Button>Padrão</Button>
            <Button size="lg">Grande</Button>
            <Button size="icon" aria-label="Adicionar placa">
              <IconPlus />
            </Button>
          </div>
        </Secao>

        <Secao
          titulo="Placas"
          explicacao="Mini placa Mercosul em três tamanhos. A placa antiga aparece como foi escrita."
        >
          <div className="flex flex-wrap items-end gap-4">
            <Placa placa="abc1d23" tamanho="p" />
            <Placa placa="ABC1D23" />
            <Placa placa="ABC-1D23" tamanho="g" />
            <Placa placa="ABC-1234" />
            <Placa placa="" />
          </div>
        </Secao>

        <Secao
          titulo="Moeda"
          explicacao="Sempre com centavos, alinhada à direita e com algarismos de largura fixa. Negativo leva sinal e fica em vermelho."
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="border-border bg-card flex w-full max-w-64 flex-col gap-1.5 rounded-lg border p-4">
              <Moeda valor={128430000} />
              <Moeda valor={-123456} />
              <Moeda valor={0} />
              <Moeda valor={999999999999999} />
              <Moeda valor={null} />
            </div>
            <div className="flex flex-col gap-4">
              <CampoDeExemplo />
              <div className="text-muted-foreground flex max-w-64 flex-col gap-1 text-sm">
                <span>Mesma largura com algarismos diferentes:</span>
                <div data-testid="largura-a">
                  <Moeda valor={1111111} />
                </div>
                <div data-testid="largura-b">
                  <Moeda valor={8888888} />
                </div>
              </div>
            </div>
          </div>
        </Secao>

        <Secao titulo="Outros formatos">
          <dl className="grid max-w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm tabular-nums">
            <dt className="text-muted-foreground">Quilometragem</dt>
            <dd className="text-right">{formatarKm(12345)}</dd>
            <dt className="text-muted-foreground">Abastecimento</dt>
            <dd className="text-right">{formatarLitros(1234.5)}</dd>
            <dt className="text-muted-foreground">Consumo</dt>
            <dd className="text-right">{formatarKmPorLitro(3.25)}</dd>
            <dt className="text-muted-foreground">Aproveitamento</dt>
            <dd className="text-right">{formatarPercentual(12.34)}</dd>
            <dt className="text-muted-foreground">Data</dt>
            <dd className="text-right">{formatarData("2026-10-29")}</dd>
          </dl>
        </Secao>

        <Secao
          titulo="Barra lateral"
          explicacao="A mesma barra do sistema, com contadores de exemplo. Esta cópia não grava memória nem responde a Ctrl+B; a de verdade está à esquerda da tela."
        >
          <div className="max-w-72">
            <BarraLateral
              incorporada
              perfil="Administrador"
              usuario="demonstracao"
              rotulo="Menu de demonstração"
              rotaAtual="/inicio/tarefas"
              contadores={CONTADORES_DE_EXEMPLO}
              estadoInicial={{ fixados: ["frota.placas"] }}
            />
          </div>
        </Secao>

        <Secao
          titulo="Logotipo e assinatura"
          explicacao="Logo provisório da TranSul em PNG, pintado pelo token da marca. O SVG oficial deve ser pedido à agência."
        >
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <Logotipo />
            <Logotipo comAssinatura={false} />
            <Logotipo recolhido />
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <AssinaturaTranSul className="h-10" />
            <AssinaturaTranSul apenasSimbolo className="h-10" />
          </div>
        </Secao>
      </div>
    </div>
  );
}
