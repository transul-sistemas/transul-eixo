import type { IdDoModulo } from "@/lib/navegacao/catalogo";
import type { Perfil } from "@/lib/navegacao/perfis";

// Espelho em TypeScript do catálogo de permissões do banco (fatia 3.6): `config.permissao_do_perfil`.
// Permissão = módulo × ação × escopo. A assinatura (md5) é conferida no Vitest e no pgTAP
// (50-permissoes-e-rls.test.sql) pela mesma constante; o seed é conferido linha a linha.

export type Acao = "ver" | "criar" | "editar" | "excluir" | "ver_documento";
export type Escopo = "tudo" | "minha_carteira" | "operacao" | "filial";

export interface PermissaoDoPerfil {
  modulo: IdDoModulo;
  acao: Acao;
  escopo: Escopo;
}

/** O código do perfil no banco (`config.perfil.codigo`). */
export const CODIGO_DO_PERFIL: Record<Perfil, string> = {
  Administrador: "administrador",
  Diretoria: "diretoria",
  "Gestor de frota": "gestor_de_frota",
  Operacional: "operacional",
};

const MODULOS: readonly IdDoModulo[] = [
  "inicio",
  "frota",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "cadastros",
  "admin",
];
const ACOES_BASICAS = ["ver", "criar", "editar", "excluir"] as const;

const tudoEmTodos: PermissaoDoPerfil[] = MODULOS.flatMap((modulo) =>
  ACOES_BASICAS.map((acao) => ({ modulo, acao, escopo: "tudo" as const })),
);

/** As permissões provisórias de cada perfil (o seed de produção). */
export const PERMISSOES_DOS_PERFIS: Record<Perfil, readonly PermissaoDoPerfil[]> = {
  Administrador: [...tudoEmTodos, { modulo: "pessoas", acao: "ver_documento", escopo: "tudo" }],
  // Só o Administrador muda acesso e permissões (10/11/2026): a Diretoria só lê a Administração.
  Diretoria: tudoEmTodos.filter((p) => p.modulo !== "admin" || p.acao === "ver"),
  "Gestor de frota": [
    { modulo: "inicio", acao: "ver", escopo: "tudo" },
    ...ACOES_BASICAS.map((acao) => ({
      modulo: "frota" as const,
      acao,
      escopo: "minha_carteira" as const,
    })),
  ],
  Operacional: [
    { modulo: "inicio", acao: "ver", escopo: "tudo" },
    ...(["ver", "criar", "editar"] as const).map((acao) => ({
      modulo: "operacional" as const,
      acao,
      escopo: "filial" as const,
    })),
    // A Escala só da filial dele (10/11/2026); a lista e a ficha de Pessoas pedem o escopo tudo.
    { modulo: "pessoas", acao: "ver", escopo: "filial" },
  ],
};

/** As permissões "perfil|módulo|ação|escopo", em ordem de código, separadas por vírgula. */
export function assinaturaDasPermissoes(): string {
  return (Object.keys(PERMISSOES_DOS_PERFIS) as Perfil[])
    .flatMap((perfil) =>
      PERMISSOES_DOS_PERFIS[perfil].map(
        (p) => `${CODIGO_DO_PERFIL[perfil]}|${p.modulo}|${p.acao}|${p.escopo}`,
      ),
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(",");
}

/** O md5 de `assinaturaDasPermissoes()`: a mesma constante que o pgTAP confere no banco. */
export const ASSINATURA_DAS_PERMISSOES = "d343d54d27c68753725c5309d7f09da1";
