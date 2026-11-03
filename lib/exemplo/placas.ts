import { carroceriaDoModelo } from "@/lib/dominio/conjunto";
import { CASOS_FEIOS } from "./casos-feios";
import { somarDias } from "./datas";
import { SIGLAS_DO_EXEMPLO } from "./siglas";
import type { PlacaDeExemplo, TipoDeAtivo } from "./tipos";

export type { PlacaDeExemplo, TipoDeAtivo } from "./tipos";

// Placas fictícias (AAA0A00 em diante), na forma do modelo futuro e sem sorteio: o mesmo dia dá
// sempre a mesma lista. Todas as datas são calculadas a partir de `hoje`, para as idades, os
// vencimentos e os alertas não envelhecerem. Nunca são importadas fora de desenvolvimento e testes
// (ver lib/qualidade/barramento-do-exemplo.ts).

const TOTAL = 240;

/**
 * Os tipos de ativo se repetem, intercalados, a cada 24 placas (6 cavalos, 10 implementos,
 * 2 equipamentos, 3 caminhões e 3 apoios), para qualquer página da lista
 * mostrar variedade. Sem sorteio: a mesma placa tem sempre o mesmo tipo.
 */
const CICLO_DE_TIPOS: readonly TipoDeAtivo[] = [..."CIIKCIEIPICIIKCIPIECIPCK"].map((letra) => {
  const porLetra: Record<string, TipoDeAtivo> = {
    C: "cavalo",
    I: "implemento",
    E: "equipamento",
    K: "caminhao",
    P: "apoio",
  };
  return porLetra[letra] as TipoDeAtivo;
});

/** Dos 100 implementos, os 90 primeiros têm cavalo (k % 60); os 10 últimos estão soltos no pátio. */
const IMPLEMENTOS_COM_CAVALO = 90;

const MODELOS: Record<TipoDeAtivo, readonly string[]> = {
  cavalo: ["FH 540", "R 450", "Actros 2651", "T 440"],
  implemento: [
    "Graneleiro 3 eixos",
    "Sider 3 eixos",
    "Baú frigorífico",
    "Prancha 4 eixos",
    "Tanque 30 mil litros",
  ],
  equipamento: ["Empilhadeira", "Carregadeira", "Guindaste"],
  caminhao: ["VM 270", "Atego 2426", "Constellation 24.280"],
  apoio: ["Van de apoio", "Camionete de apoio", "Strada", "Saveiro", "Hilux"],
};

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function placaDe(i: number): string {
  const digito = Math.floor(i / 2600) % 10;
  const letra = LETRAS[Math.floor(i / 100) % 26];
  return `AAA${digito}${letra}${String(i % 100).padStart(2, "0")}`;
}

function tipoDe(i: number): TipoDeAtivo {
  return CICLO_DE_TIPOS[i % CICLO_DE_TIPOS.length] as TipoDeAtivo;
}

const dois = (n: number) => String(n).padStart(2, "0");

function base(i: number, hoje: string): PlacaDeExemplo {
  const tipo = tipoDe(i);
  const modelos = MODELOS[tipo];
  const indiceDaOperacao = i % 5;
  const temOperacao = i % 17 !== 0;
  const operacao = temOperacao ? `Operação Exemplo ${indiceDaOperacao + 1}` : null;
  const motorista =
    (tipo === "cavalo" || tipo === "caminhao") && i % 11 !== 0
      ? `Motorista Exemplo ${String(i).padStart(3, "0")}`
      : null;
  const motorizado = tipo !== "implemento" && tipo !== "equipamento";
  const fipeBase = { cavalo: 250_000, caminhao: 180_000, apoio: 90_000 } as const;
  const faixaFipe = fipeBase[tipo as keyof typeof fipeBase];
  const historico = tipo === "cavalo" && i % 9 === 1;

  return {
    id: `pl-${String(i).padStart(3, "0")}`,
    placa: placaDe(i),
    renavam: String(40_000_000_000 + i * 104_729).padStart(11, "0"),
    tipo,
    modelo: modelos[i % modelos.length] as string,
    ano: i % 53 === 0 ? null : 2012 + ((i * 5) % 14),
    sigla: SIGLAS_DO_EXEMPLO[(i * 7 + 3) % SIGLAS_DO_EXEMPLO.length] as PlacaDeExemplo["sigla"],
    desde: `${somarDias(hoje, -((i * 3) % 25))}T${dois(6 + (i % 12))}:${dois((i * 7) % 60)}`,
    filial: `Filial Exemplo ${"ABCD"[i % 4]}`,
    operacao,
    crs: operacao
      ? historico
        ? [
            {
              codigo: "CR-1900",
              nome: "Operação Exemplo antiga",
              inicio: somarDias(hoje, -400),
              fim: somarDias(hoje, -120),
            },
            {
              codigo: `CR-${1001 + indiceDaOperacao}`,
              nome: operacao,
              inicio: somarDias(hoje, -120),
              fim: null,
            },
          ]
        : [
            {
              codigo: `CR-${1001 + indiceDaOperacao}`,
              nome: operacao,
              inicio: somarDias(hoje, -(200 + (i % 100))),
              fim: null,
            },
          ]
      : [],
    gestor: `Gestor Exemplo ${(i % 6) + 1}`,
    motorista,
    crlvVenceEm: i % 37 === 5 ? null : somarDias(hoje, 20 + ((i * 13) % 330)),
    km: motorizado && i % 29 !== 0 ? 20_000 + ((i * 7_919) % 900_000) : null,
    valorFipeCentavos:
      faixa(tipo, i, faixaFipe) === null ? null : (faixa(tipo, i, faixaFipe) as number) * 100,
    conjunto: { cavaloId: null, implementoIds: [] },
  };
}

/** Valor FIPE em reais inteiros, ou nulo quando o tipo não tem tabela ou falta o dado. */
function faixa(tipo: TipoDeAtivo, i: number, minimo: number | undefined): number | null {
  if (minimo !== undefined) return i % 19 === 0 ? null : minimo + ((i * 15_731) % 350_000);
  if (tipo === "implemento") return i % 4 === 0 ? null : 60_000 + ((i * 9_173) % 120_000);
  return null;
}

function comCasoFeio(placa: PlacaDeExemplo, hoje: string): PlacaDeExemplo {
  const caso = CASOS_FEIOS[placa.placa];
  return caso ? caso.ajustar(placa, hoje) : placa;
}

/** As placas de exemplo "em" `hoje` (`aaaa-mm-dd`): determinísticas para um mesmo dia. */
export function placasDeExemplo(hoje: string): PlacaDeExemplo[] {
  const indices = Array.from({ length: TOTAL }, (_, i) => i);
  const cavalos = indices
    .filter((i) => tipoDe(i) === "cavalo")
    .map((i) => comCasoFeio(base(i, hoje), hoje));
  const outros = indices
    .filter((i) => tipoDe(i) !== "cavalo" && tipoDe(i) !== "implemento")
    .map((i) => comCasoFeio(base(i, hoje), hoje));

  // Conjunto misto de carrocerias é bloqueado: cada cavalo só recebe implementos da mesma carroceria.
  const carroceriaDoCavalo = new Map<string, string>();
  const implementos = indices
    .filter((i) => tipoDe(i) === "implemento")
    .map((i, k) => {
      const placa = base(i, hoje);
      const carroceria = carroceriaDoModelo(placa.modelo);
      const cavalo =
        k < IMPLEMENTOS_COM_CAVALO
          ? Array.from({ length: cavalos.length }, (_, d) => cavalos[(k + d) % cavalos.length])
              .filter((c) => c !== undefined)
              .find((c) => (carroceriaDoCavalo.get(c.id) ?? carroceria) === carroceria)
          : undefined;
      if (cavalo) {
        carroceriaDoCavalo.set(cavalo.id, carroceria);
        cavalo.conjunto.implementoIds.push(placa.id);
        return comCasoFeio(
          {
            ...placa,
            sigla: cavalo.sigla,
            desde: cavalo.desde,
            operacao: cavalo.operacao,
            // Herda só o CR vigente da operação do cavalo (a duplicidade é do cavalo, não do conjunto).
            crs: cavalo.crs
              .filter(
                (cr) =>
                  cr.nome === cavalo.operacao &&
                  cr.inicio <= hoje &&
                  (cr.fim === null || hoje < cr.fim),
              )
              .map((cr) => ({ ...cr })),
            conjunto: { cavaloId: cavalo.id, implementoIds: [] },
          },
          hoje,
        );
      }
      const solto = k - IMPLEMENTOS_COM_CAVALO;
      const recente = solto >= 8;
      const diasSolto = recente ? 5 + (solto - 8) * 7 : 35 + solto * 4;
      return comCasoFeio(
        {
          ...placa,
          sigla: "PÁT",
          desde: `${somarDias(hoje, -diasSolto)}T09:00`,
          operacao: null,
          crs: [],
        },
        hoje,
      );
    });

  return [...cavalos, ...implementos, ...outros].sort((a, b) => (a.placa < b.placa ? -1 : 1));
}
