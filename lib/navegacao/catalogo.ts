import type { Modulo } from "@/lib/visual/tons";

// Catálogo único de navegação do Eixo. Barra lateral, Ctrl+K, trilha e rotas leem só este arquivo.
// Ícones são nomes de componentes do Tabler (components/navegacao/icones.ts resolve o nome).

/**
 * `esqueleto`: a tela abre inteira, no padrão de telas, mas sem fonte de dados ainda ("Sem dados ainda:
 * depende de ..."); só Administrador e Diretoria a veem, com o selo "Estrutura" no menu.
 */
export type EstadoDaTela = "pronto" | "esqueleto" | "em-breve" | "restrito";
export type Dispositivo = "desktop" | "tablet" | "celular";
export type IdDoModulo = "inicio" | Modulo;

/** Visão dentro de uma tela, guardada em `?modo=<id>` na URL. Não é rota. */
export interface ModoDaTela {
  readonly id: string;
  readonly nome: string;
}

/** Atalho da busca rápida (Ctrl+K) para uma rota filha da tela; não entra no menu lateral nem nos modos. */
export interface AtalhoDaTela {
  readonly id: string;
  readonly nome: string;
  readonly rota: string;
}

export interface Tela {
  readonly id: string;
  readonly nome: string;
  readonly icone: string;
  readonly rota: string;
  readonly permissao: { readonly modulo: IdDoModulo; readonly acao: "ver" };
  readonly estado: EstadoDaTela;
  /** Uma linha do que a tela fará. */
  readonly descricao: string;
  readonly dispositivos: readonly Dispositivo[];
  readonly modos?: readonly ModoDaTela[];
  readonly atalhos?: readonly AtalhoDaTela[];
  /** A lista abre a ficha de cada item em `<rota>/<identificador>` (placa, pessoa, operação, parceiro). */
  readonly ficha?: true;
  /** O que o selo de contagem do item conta, para o leitor de tela ("3 para receber"). */
  readonly contador?: string;
  /** Indicador de teste: a tela só aparece e só abre para o Administrador (TELAS_SO_DO_ADMINISTRADOR). */
  readonly selo?: "Teste";
}

export interface ModuloDoCatalogo {
  readonly id: IdDoModulo;
  readonly nome: string;
  readonly icone: string;
  /** Prefixo das rotas do módulo. O módulo leva à sua primeira tela visível. */
  readonly rota: string;
  /** Início usa o azul de ação; os demais, a cor do módulo (Administração usa a de Cadastros). */
  readonly cor: "acao" | Modulo;
  readonly telas: readonly Tela[];
}

const DESKTOP: readonly Dispositivo[] = ["desktop"];
const DESKTOP_E_TABLET: readonly Dispositivo[] = ["desktop", "tablet"];
const TODOS: readonly Dispositivo[] = ["desktop", "tablet", "celular"];
const TABLET_E_CELULAR: readonly Dispositivo[] = ["tablet", "celular"];

interface DadosDaTela {
  slug: string;
  nome: string;
  icone: string;
  dispositivos: readonly Dispositivo[];
  descricao: string;
  estado?: EstadoDaTela;
  modos?: readonly ModoDaTela[];
  atalhos?: readonly AtalhoDaTela[];
  ficha?: true;
  contador?: string;
  selo?: "Teste";
}

function modulo(
  id: IdDoModulo,
  nome: string,
  icone: string,
  cor: ModuloDoCatalogo["cor"],
  telas: readonly DadosDaTela[],
): ModuloDoCatalogo {
  return {
    id,
    nome,
    icone,
    rota: `/${id}`,
    cor,
    telas: telas.map(({ slug, estado, ...dados }) => ({
      ...dados,
      id: `${id}.${slug}`,
      rota: `/${id}/${slug}`,
      permissao: { modulo: id, acao: "ver" },
      estado: estado ?? "em-breve",
    })),
  };
}

export const CATALOGO: readonly ModuloDoCatalogo[] = [
  modulo("inicio", "Início", "IconHome2", "acao", [
    {
      slug: "tarefas",
      nome: "Tarefas",
      icone: "IconChecklist",
      dispositivos: TODOS,
      descricao: "Reúne o que espera a sua ação, como a aprovação de casos.",
      estado: "pronto",
    },
    {
      slug: "meu-dia",
      nome: "Meu dia",
      icone: "IconListCheck",
      dispositivos: DESKTOP_E_TABLET,
      descricao:
        "Guia o dia do gestor de frota: recebe as placas em lote e leva às próximas tarefas.",
      estado: "pronto",
      selo: "Teste",
    },
    {
      slug: "resumo-do-dia",
      nome: "Resumo do dia",
      icone: "IconSunHigh",
      dispositivos: DESKTOP_E_TABLET,
      descricao: "Mostra, em uma página, como a operação está hoje.",
      estado: "esqueleto",
    },
    {
      slug: "mapa-do-sistema",
      nome: "Mapa do sistema",
      icone: "IconSitemap",
      dispositivos: DESKTOP,
      descricao: "Mostra todos os módulos e telas e o que já está pronto.",
      estado: "pronto",
    },
  ]),
  modulo("frota", "Frota", "IconTruck", "frota", [
    {
      slug: "acompanhamento",
      nome: "Acompanhamento",
      icone: "IconListDetails",
      dispositivos: DESKTOP_E_TABLET,
      descricao:
        "Acompanha cada placa pela régua de status, nos modos Grade (Conjuntos e Soltas), Agora, Censo e Mapa.",
      estado: "pronto",
      modos: [
        { id: "grade", nome: "Grade · Conjuntos" },
        { id: "soltas", nome: "Grade · Soltas" },
        { id: "agora", nome: "Agora" },
        { id: "censo", nome: "Censo" },
        { id: "mapa", nome: "Mapa" },
      ],
      atalhos: [{ id: "legenda", nome: "Legenda e siglas", rota: "/frota/acompanhamento/legenda" }],
    },
    {
      slug: "placas",
      nome: "Placas",
      icone: "IconLicense",
      dispositivos: DESKTOP_E_TABLET,
      descricao: "Lista todas as placas e abre a ficha de cada uma.",
      contador: "para receber",
      ficha: true,
      estado: "pronto",
    },
    {
      slug: "abastecimento",
      nome: "Abastecimento",
      icone: "IconGasStation",
      dispositivos: DESKTOP,
      descricao: "Mostra o abastecimento por placa, com litros e consumo.",
      estado: "pronto",
    },
    {
      slug: "carteira",
      nome: "Carteira",
      icone: "IconWallet",
      dispositivos: TODOS,
      descricao: "Confirma a carteira mensal, placa a placa.",
      estado: "pronto",
    },
    {
      slug: "excecoes",
      nome: "Exceções",
      icone: "IconAlertTriangle",
      dispositivos: DESKTOP_E_TABLET,
      descricao: "Reúne o que o cadastro não resolveu sozinho e leva a completar o dado.",
      estado: "pronto",
    },
    {
      slug: "analise",
      nome: "Análise",
      icone: "IconChartLine",
      dispositivos: DESKTOP,
      descricao: "Explica as variações da frota em quatro camadas.",
      estado: "pronto",
    },
  ]),
  modulo("operacional", "Operacional", "IconBuildingWarehouse", "operacional", [
    {
      slug: "patio",
      nome: "Pátio",
      icone: "IconParking",
      dispositivos: TODOS,
      descricao: "Mostra as placas no pátio e a fila por ordem de chegada.",
      estado: "pronto",
    },
    {
      slug: "totem",
      nome: "Totem",
      icone: "IconTicket",
      dispositivos: TABLET_E_CELULAR,
      descricao: "Registra a chegada do motorista no totem e o coloca na fila.",
      estado: "pronto",
    },
    {
      slug: "ordens-de-carregamento",
      nome: "Ordens de carregamento",
      icone: "IconClipboardList",
      dispositivos: DESKTOP_E_TABLET,
      descricao: "Acompanha cada ordem de carregamento de ponta a ponta.",
      estado: "pronto",
    },
    {
      slug: "analise",
      nome: "Análise",
      icone: "IconChartLine",
      dispositivos: DESKTOP,
      descricao: "Mede o tempo de cada etapa do Operacional.",
      estado: "pronto",
    },
  ]),
  modulo("operacoes", "Operações", "IconRoute", "operacoes", [
    {
      slug: "lista",
      nome: "Operações",
      icone: "IconRoute2",
      dispositivos: DESKTOP,
      descricao: "Lista as operações e abre a ficha de cada uma.",
      ficha: true,
      estado: "pronto",
    },
    {
      slug: "comparativo",
      nome: "Comparativo",
      icone: "IconScale",
      dispositivos: DESKTOP,
      descricao: "Compara o resultado entre operações.",
      estado: "pronto",
    },
    {
      slug: "analise",
      nome: "Análise",
      icone: "IconChartLine",
      dispositivos: DESKTOP,
      descricao: "Explica as variações de cada operação.",
      estado: "pronto",
    },
  ]),
  modulo("pessoas", "Pessoas", "IconUsers", "pessoas", [
    {
      slug: "lista",
      nome: "Pessoas",
      icone: "IconUser",
      dispositivos: DESKTOP_E_TABLET,
      descricao: "Lista as pessoas e abre a ficha de cada uma.",
      ficha: true,
      estado: "pronto",
    },
    {
      slug: "escala",
      nome: "Escala",
      icone: "IconCalendarWeek",
      dispositivos: DESKTOP_E_TABLET,
      descricao: "Monta e acompanha a escala do mês.",
      estado: "pronto",
    },
    {
      slug: "status-diario",
      nome: "Status diário",
      icone: "IconCalendarCheck",
      dispositivos: TODOS,
      descricao: "Registra o status do dia de cada pessoa.",
      estado: "pronto",
    },
    {
      slug: "documentos",
      nome: "Documentos",
      icone: "IconFiles",
      dispositivos: DESKTOP,
      descricao: "Controla os documentos e os vencimentos.",
      estado: "pronto",
    },
    {
      slug: "diarias-e-premiacao",
      nome: "Diárias e premiação",
      icone: "IconCash",
      dispositivos: DESKTOP,
      descricao: "Calcula as diárias e as premiações do período.",
      estado: "pronto",
    },
    {
      slug: "campanhas",
      nome: "Campanhas",
      icone: "IconSpeakerphone",
      dispositivos: DESKTOP,
      descricao: "Gerencia as campanhas e acompanha os resultados.",
      estado: "pronto",
    },
    {
      slug: "analise",
      nome: "Análise",
      icone: "IconChartLine",
      dispositivos: DESKTOP,
      descricao: "Explica as variações de pessoal.",
      estado: "pronto",
    },
  ]),
  modulo("parceiros", "Parceiros", "IconHeartHandshake", "parceiros", [
    {
      slug: "lista",
      nome: "Parceiros",
      icone: "IconBuildingStore",
      dispositivos: DESKTOP,
      descricao: "Lista os parceiros e abre a ficha de cada um.",
      ficha: true,
      estado: "pronto",
    },
    {
      slug: "conciliacao",
      nome: "Conciliação",
      icone: "IconArrowsExchange",
      dispositivos: DESKTOP,
      descricao: "Confere os valores dos parceiros com o Sankhya.",
      estado: "pronto",
    },
    {
      slug: "livro-do-acionista",
      nome: "Livro do acionista",
      icone: "IconBook",
      dispositivos: DESKTOP,
      descricao: "Mostra o livro do acionista e os seus lançamentos.",
      estado: "esqueleto",
    },
    {
      slug: "locacao",
      nome: "Locação",
      icone: "IconKey",
      dispositivos: DESKTOP,
      descricao: "Acompanha os contratos de locação.",
      estado: "pronto",
    },
  ]),
  modulo("resultados", "Resultados", "IconChartBar", "resultados", [
    {
      slug: "visao-geral",
      nome: "Visão geral",
      icone: "IconLayoutDashboard",
      dispositivos: DESKTOP,
      descricao: "Mostra o resultado do mês e de onde ele vem.",
      estado: "pronto",
    },
    {
      slug: "por-operacao",
      nome: "Por operação",
      icone: "IconRoute",
      dispositivos: DESKTOP,
      descricao: "Mostra o resultado de cada operação.",
      estado: "pronto",
    },
    {
      slug: "maturacao",
      nome: "Maturação",
      icone: "IconHourglass",
      dispositivos: DESKTOP,
      descricao: "Acompanha a quitação da dívida antiga.",
      estado: "pronto",
    },
    {
      slug: "fechamentos",
      nome: "Fechamentos",
      icone: "IconLock",
      dispositivos: DESKTOP,
      descricao: "Guarda a foto de cada mês fechado.",
      estado: "pronto",
    },
    {
      slug: "ajustes",
      nome: "Ajustes",
      icone: "IconAdjustments",
      dispositivos: DESKTOP,
      descricao: "Registra ajustes justificados, com aprovação por alçada.",
      estado: "pronto",
    },
  ]),
  modulo("cadastros", "Cadastros", "IconDatabase", "cadastros", [
    {
      slug: "catalogos",
      nome: "Catálogos e parâmetros",
      icone: "IconListDetails",
      dispositivos: DESKTOP,
      descricao: "Mantém catálogos, regras e parâmetros, como o dia do corte da competência.",
      estado: "pronto",
    },
    {
      slug: "saude-do-cr",
      nome: "Saúde do CR",
      icone: "IconListDetails",
      dispositivos: DESKTOP,
      descricao:
        "Placa sem CR, CR sem operação, dois CRs do mesmo tipo e lançamento sem CR, com dono e prazo.",
      estado: "pronto",
    },
  ]),
  modulo("admin", "Administração", "IconSettings", "admin", [
    {
      slug: "usuarios-e-perfis",
      nome: "Usuários e perfis",
      icone: "IconUserShield",
      dispositivos: DESKTOP,
      descricao: "Gerencia usuários, perfis e permissões.",
      estado: "pronto",
    },
    {
      slug: "auditoria",
      nome: "Auditoria",
      icone: "IconHistory",
      dispositivos: DESKTOP,
      descricao: "Mostra quem fez o quê, quando e por quê.",
      estado: "esqueleto",
    },
    {
      slug: "demonstracao",
      nome: "Demonstração",
      icone: "IconPalette",
      dispositivos: DESKTOP,
      descricao: "Mostra a base visual do Eixo, componente por componente.",
      estado: "pronto",
    },
  ]),
];

export function todasAsTelas(): readonly Tela[] {
  return CATALOGO.flatMap((m) => m.telas);
}

/** Acha a tela pela rota. Ignora `?modo=`, `#` e a barra final. */
export function acharTela(rota: string): { modulo: ModuloDoCatalogo; tela: Tela } | undefined {
  const caminho = (rota.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  for (const m of CATALOGO) {
    const tela = m.telas.find((t) => t.rota === caminho);
    if (tela) return { modulo: m, tela };
  }
  return undefined;
}

/**
 * Acha a ficha pela rota filha `/<tela>/<identificador>` de uma tela marcada com `ficha`, e devolve
 * o módulo, a tela e o identificador (a placa, por exemplo). Ignora `?aba=`, `#` e a barra final.
 * Identificador com escape quebrado, vazio, de mais de 40 caracteres ou com algo além de letras,
 * números, hífen e sublinhado não é ficha.
 */
export function acharFicha(
  rota: string,
): { modulo: ModuloDoCatalogo; tela: Tela; identificador: string } | undefined {
  const caminho = (rota.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  const barra = caminho.lastIndexOf("/");
  if (barra <= 0) return undefined;
  let identificador: string;
  try {
    identificador = decodeURIComponent(caminho.slice(barra + 1));
  } catch {
    return undefined;
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(identificador)) return undefined;
  const pai = caminho.slice(0, barra);
  for (const m of CATALOGO) {
    const tela = m.telas.find((t) => t.rota === pai && t.ficha);
    if (tela) return { modulo: m, tela, identificador };
  }
  return undefined;
}
