import { CATALOGO, type ModoDaTela, type ModuloDoCatalogo, type Tela } from "./catalogo";
import type { Perfil } from "./perfis";
import { modulosVisiveis, podeAbrir } from "./visibilidade";

export interface ResultadoDeBusca {
  readonly modulo: ModuloDoCatalogo;
  readonly tela: Tela;
  /** Presente quando o resultado é um modo da tela, como "Mapa" no Acompanhamento. */
  readonly modo?: ModoDaTela;
  /** Rota para abrir; para um modo, a da tela com `?modo=<id>`. */
  readonly rota: string;
  /** "Frota › Acompanhamento › Mapa" */
  readonly rotulo: string;
}

/** Minúscula, sem acento e sem espaço sobrando. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

interface Candidato extends ResultadoDeBusca {
  /** Módulo, tela e modo juntos, normalizados: onde os termos são procurados. */
  readonly texto: string;
  /** Nome que o resultado mostra (tela ou modo), normalizado, para ordenar. */
  readonly alvo: string;
}

function candidatos(
  perfil: Perfil,
  catalogo: readonly ModuloDoCatalogo[],
  emDemonstracao: boolean,
): Candidato[] {
  const lista: Candidato[] = [];
  for (const modulo of modulosVisiveis(perfil, catalogo, emDemonstracao)) {
    for (const tela of modulo.telas) {
      if (!podeAbrir(perfil, tela, emDemonstracao)) continue;
      const base = `${modulo.nome} › ${tela.nome}`;
      lista.push({
        modulo,
        tela,
        rota: tela.rota,
        rotulo: base,
        texto: normalizar(`${modulo.nome} ${tela.nome}`),
        alvo: normalizar(tela.nome),
      });
      for (const modo of tela.modos ?? []) {
        lista.push({
          modulo,
          tela,
          modo,
          rota: `${tela.rota}?modo=${modo.id}`,
          rotulo: `${base} › ${modo.nome}`,
          texto: normalizar(`${modulo.nome} ${tela.nome} ${modo.nome}`),
          alvo: normalizar(modo.nome),
        });
      }
      for (const atalho of tela.atalhos ?? []) {
        lista.push({
          modulo,
          tela,
          modo: { id: atalho.id, nome: atalho.nome },
          rota: atalho.rota,
          rotulo: `${base} › ${atalho.nome}`,
          texto: normalizar(`${modulo.nome} ${tela.nome} ${atalho.nome}`),
          alvo: normalizar(atalho.nome),
        });
      }
    }
  }
  return lista;
}

/** 0: o nome começa pelo que foi digitado; 1: uma palavra do nome começa; 2: o nome contém; 3: só o contexto. */
export function notaDoNome(alvo: string, termo: string, primeiro: string): number {
  if (alvo.startsWith(termo)) return 0;
  if (alvo.split(" ").some((palavra) => palavra.startsWith(primeiro))) return 1;
  if (alvo.includes(primeiro)) return 2;
  return 3;
}

function pontuar(candidato: Candidato, termo: string, primeiro: string): number {
  return notaDoNome(candidato.alvo, termo, primeiro);
}

/**
 * Busca telas e modos que o perfil pode abrir, por nome de módulo, tela ou modo (sem acento nem
 * maiúscula). Todas as palavras digitadas precisam aparecer. Termo vazio não devolve nada.
 */
export function buscarTelas(
  termo: string,
  perfil: Perfil,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
  emDemonstracao = false,
): readonly ResultadoDeBusca[] {
  const normalizado = normalizar(termo);
  if (normalizado === "") return [];
  const palavras = normalizado.split(" ");
  const primeiro = palavras[0] ?? normalizado;
  return candidatos(perfil, catalogo, emDemonstracao)
    .map((candidato, ordem) => ({ candidato, ordem }))
    .filter(({ candidato }) => palavras.every((palavra) => candidato.texto.includes(palavra)))
    .map((item) => ({ ...item, nota: pontuar(item.candidato, normalizado, primeiro) }))
    .sort((a, b) => a.nota - b.nota || a.ordem - b.ordem)
    .map(({ candidato: { modulo, tela, modo, rota, rotulo } }) => ({
      modulo,
      tela,
      ...(modo ? { modo } : {}),
      rota,
      rotulo,
    }));
}
