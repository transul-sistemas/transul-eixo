// Dados de DEMONSTRAÇÃO do Eixo (10/11/2026): as regras puras, sem banco. Tudo é fictício e marcado:
//  * nome com a marca "Demo";
//  * CPF na faixa 95000nnnn-dd (9 dígitos-base 95000 + n de 0001 a 0999) e CNPJ na faixa 9900nnnn0001-dd,
//    sempre com dígitos verificadores válidos;
//  * placa no bloco ZDM (ZDM + dígito + letra + dois dígitos), que o desenvolvimento antigo (placas "D...")
//    também não usa;
//  * CR com código "DEMO-n" e codcencus 2990nnn, 4990nnn ou 6990nnn (raiz 2, 4 ou 6, para o banco achar a garagem);
//  * RENAVAM com prefixo 99000 (o dígito verificador é escolhido pelo banco);
//  * abastecimento com origem "demo" e origem_id "DEMO-...".
// Nada disto entra em migration nem no seed (teste em demo-dados.test.ts). O carregamento é o
// scripts/demo-carregar.ts, só no Supabase local.
import { bancoLocal } from "./banco-local.ts";
import { ErroDoEixo } from "../lib/log/erro.ts";

export const PREFIXO_DA_PLACA_DEMO = "ZDM";
export const PREFIXO_DO_CPF_DEMO = "95000";
export const PREFIXO_DO_CNPJ_DEMO = "9900";
export const PREFIXO_DO_RENAVAM_DEMO = "99000";

/** CODCENCUS do CR fictício número n (1 a 300): raiz 2, 4 ou 6 e 990nnn, nunca de 8 dígitos. */
export function codcencusDemo(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 300) {
    throw new ErroDoEixo("O CR da demonstração vai do número 1 ao 300.");
  }
  return [2, 4, 6][n % 3]! * 1_000_000 + 990_000 + n;
}

/** Recusa qualquer banco que não seja o Supabase da própria máquina (nunca a nuvem). */
export function exigirBancoLocalParaDemo(endereco: string): void {
  if (!bancoLocal(endereco)) {
    throw new ErroDoEixo("Recusado: os dados de demonstração só rodam no Supabase local.");
  }
}

function digitoDoCpf(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
  const r = (soma * 10) % 11;
  return r === 10 ? 0 : r;
}

/** CPF fictício número n (1 a 999), com os dois dígitos verificadores válidos. */
export function cpfFicticio(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new ErroDoEixo("O CPF fictício vai do número 1 ao 999.");
  }
  const base = PREFIXO_DO_CPF_DEMO + String(n).padStart(4, "0");
  const d1 = digitoDoCpf(base);
  const d2 = digitoDoCpf(base + d1);
  return `${base}${d1}${d2}`;
}

export function ehCpfDaDemo(cpf: string): boolean {
  return /^\d{11}$/.test(cpf) && cpf.startsWith(PREFIXO_DO_CPF_DEMO);
}

function digitoDoCnpj(base: string): number {
  const pesos =
    base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = pesos.reduce((s, p, i) => s + p * Number(base[i]), 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

/** CNPJ fictício número n (1 a 9999), matriz 0001, com os dois dígitos verificadores válidos. */
export function cnpjFicticio(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 9999) {
    throw new ErroDoEixo("O CNPJ fictício vai do número 1 ao 9999.");
  }
  const base = PREFIXO_DO_CNPJ_DEMO + String(n).padStart(4, "0") + "0001";
  const d1 = digitoDoCnpj(base);
  const d2 = digitoDoCnpj(base + d1);
  return `${base}${d1}${d2}`;
}

export function ehCnpjDaDemo(cnpj: string): boolean {
  return (
    /^\d{14}$/.test(cnpj) && cnpj.startsWith(PREFIXO_DO_CNPJ_DEMO) && cnpj.slice(8, 12) === "0001"
  );
}

/** Placa Mercosul do bloco da demonstração, número 1 a 2600: ZDM + dígito + letra + dois dígitos. */
export function placaDemo(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 2600) {
    throw new ErroDoEixo("A placa da demonstração vai do número 1 ao 2600.");
  }
  const i = n - 1;
  const digito = Math.floor(i / 260) % 10;
  const letra = String.fromCharCode(65 + Math.floor((i % 260) / 10));
  return `${PREFIXO_DA_PLACA_DEMO}${digito}${letra}${String(i % 10).padStart(2, "0")}`;
}

const PRIMEIROS = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Fábio",
  "Gabriela",
  "Heitor",
  "Irene",
  "João",
  "Karina",
  "Lucas",
  "Marta",
  "Nelson",
  "Olívia",
  "Paulo",
  "Rafaela",
  "Sérgio",
  "Tânia",
  "Vitor",
];
const SOBRENOMES = [
  "Almeida",
  "Barros",
  "Cardoso",
  "Dias",
  "Esteves",
  "Ferraz",
  "Gomes",
  "Holanda",
  "Ibarra",
  "Junqueira",
  "Lacerda",
  "Moura",
  "Nogueira",
  "Oliveira",
  "Pacheco",
];

/** Nome fictício número i: sempre começa com a marca "Demo". */
export function nomeDeDemo(i: number): string {
  const sobrenome = SOBRENOMES[(i * 7 + Math.floor(i / 20)) % SOBRENOMES.length];
  return `Demo ${PRIMEIROS[i % PRIMEIROS.length]} ${sobrenome}`;
}

/** Soma dias a uma data ISO (aaaa-mm-dd), sem fuso. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês, deslocado em `meses` (negativo = antes). */
export function primeiroDiaDoMes(iso: string, meses = 0): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
}

const FUNCOES = [
  "motorista",
  "motorista",
  "motorista",
  "motorista",
  "ajudante",
  "mecanico",
  "operador",
  "lider",
  "administrativo",
] as const;

export type PessoaDaDemo = {
  nome: string;
  cpf: string;
  funcao: (typeof FUNCOES)[number];
  /** Posição na lista de operações (as de tipo "operacao", em ordem de nome). */
  operacaoIndice: number;
  /** O vínculo começa no primeiro dia do mês anterior. */
  inicio: string;
};

/** As pessoas fictícias: o CPF de cada uma é o número (deslocamento + posição + 1). */
export function planoDasPessoas(
  hoje: string,
  quantidade: number,
  operacoes: number,
  deslocamento = 100,
): PessoaDaDemo[] {
  const inicio = primeiroDiaDoMes(hoje, -1);
  return Array.from({ length: quantidade }, (_, i) => ({
    nome: nomeDeDemo(deslocamento + i),
    cpf: cpfFicticio(deslocamento + i + 1),
    funcao: FUNCOES[i % FUNCOES.length]!,
    operacaoIndice: i % Math.max(operacoes, 1),
    inicio,
  }));
}

/** A marcação da escala da pessoa i no dia: trabalho, folga, férias ou atestado (determinística). */
export function diaDaEscala(pessoa: number, dia: string): "T" | "F" | "FE" | "AT" {
  const d = new Date(`${dia}T00:00:00Z`);
  const semana = d.getUTCDay();
  const diaDoMes = d.getUTCDate();
  if (pessoa % 11 === 0 && diaDoMes >= 12 && diaDoMes <= 18) return "FE";
  if (pessoa % 13 === 0 && diaDoMes >= 3 && diaDoMes <= 4) return "AT";
  if (semana === 0 || pessoa % 7 === semana) return "F";
  return "T";
}

export type AbastecimentoDaDemo = {
  origemId: string;
  placa: string;
  data: string;
  kmInicial: number;
  kmFinal: number;
  litros: number;
  valorTotal: number;
  combustivel: string;
  origem: "demo";
};

/** Quatro abastecimentos por placa em cada um dos três meses anteriores ao de `hoje`, com hodômetro e litros válidos. */
export function abastecimentosDaDemo(
  hoje: string,
  placas: readonly string[],
): AbastecimentoDaDemo[] {
  const saida: AbastecimentoDaDemo[] = [];
  placas.forEach((placa, p) => {
    let hodometro = 120000 + p * 7300;
    for (const deslocamento of [-3, -2, -1]) {
      const mes = primeiroDiaDoMes(hoje, deslocamento);
      [3, 10, 17, 24].forEach((dia, k) => {
        const trecho = 650 + ((p * 37 + k * 91 + Math.abs(deslocamento) * 53) % 420);
        const litros = Math.round((trecho / (2.1 + ((p + k) % 5) / 10)) * 1000) / 1000;
        const data = `${mes.slice(0, 8)}${String(dia).padStart(2, "0")}`;
        saida.push({
          origemId: `DEMO-${placa}-${data}`,
          placa,
          data,
          kmInicial: hodometro,
          kmFinal: hodometro + trecho,
          litros,
          valorTotal: Math.round(litros * 6.12 * 100) / 100,
          combustivel: "Diesel S10",
          origem: "demo",
        });
        hodometro += trecho;
      });
    }
  });
  return saida;
}

// ---------------------------------------------------------------------------------------------
// Cenários de observação (12/11/2026): pedidos atrasados, vínculos com história e movimento recente.
// Só regras puras; quem grava é o scripts/demo-carregar.ts, pelas funções e caminhos legítimos do banco.
// ---------------------------------------------------------------------------------------------

/** A chave em config.parametro que liga a faixa "banco em demonstração" (a restauração do real a remove). */
export const CHAVE_DA_FAIXA_DEMO = "banco_em_demonstracao";
export const TEXTO_DA_FAIXA_DEMO =
  "Banco em demonstração: números fictícios misturados com os reais";

/** Prazo para receber a placa (decisão H4): passado dele, o pedido aberto está atrasado. */
export const PRAZO_DE_RECEBER_EM_DIAS = 5;

export function pedidoAtrasado(diasAbertos: number): boolean {
  return diasAbertos > PRAZO_DE_RECEBER_EM_DIAS;
}

export type PedidoDaDemo = {
  /** Número do cavalo da demonstração (1 a 30). */
  cavalo: number;
  /** Há quantos dias o pedido foi aberto. */
  diasAbertos: number;
  situacao: "pendente" | "em_conferencia";
  /** Pendências conhecidas; sem resposta, ficam abertas na conferência. */
  pendencias: string[];
};

/** Pedidos de transferência além dos cinco do "Para receber": atrasados, em conferência e no prazo. */
export function planoDosPedidos(): PedidoDaDemo[] {
  return [
    { cavalo: 11, diasAbertos: 9, situacao: "pendente", pendencias: [] },
    { cavalo: 12, diasAbertos: 7, situacao: "pendente", pendencias: ["Conferir o estepe"] },
    { cavalo: 13, diasAbertos: 14, situacao: "pendente", pendencias: [] },
    {
      cavalo: 14,
      diasAbertos: 8,
      situacao: "em_conferencia",
      pendencias: ["Documento do veículo vencido", "Multa em aberto"],
    },
    {
      cavalo: 15,
      diasAbertos: 3,
      situacao: "em_conferencia",
      pendencias: ["Avaria no para-choque"],
    },
    { cavalo: 16, diasAbertos: 2, situacao: "pendente", pendencias: [] },
  ];
}

export type VinculoComHistoria = {
  /** Número da placa da demonstração (e do CR atual). */
  placa: number;
  crAntigo: number;
  crAtual: number;
  /** Posição das operações na lista (módulo o total). */
  operacaoAntiga: number;
  operacaoAtual: number;
  /** Há quantos dias a placa e o CR antigo começaram. */
  inicioHaDias: number;
  /** Há quantos dias o CR antigo terminou e o atual começou. */
  trocaHaDias: number;
};

export const TROCA_RECENTE_EM_DIAS = 14;

/** Seis placas com CR encerrado numa operação e CR vigente em outra; duas com troca recente. */
export function planoDosVinculos(): VinculoComHistoria[] {
  const trocas = [5, 12, 40, 55, 70, 90];
  return trocas.map((trocaHaDias, i) => ({
    placa: 51 + i,
    crAntigo: 101 + i,
    crAtual: 51 + i,
    operacaoAntiga: i,
    operacaoAtual: i + 1,
    inicioHaDias: 120,
    trocaHaDias,
  }));
}

const SIGLAS_DE_CONJUNTO = [
  "ETc",
  "CAr",
  "DEs",
  "ETv",
  "ACe",
  "CAn",
  "ADe",
  "MAc",
  "MAt",
  "FOg",
  "SMo",
  "DOC",
  "PÁT",
];
const SIGLAS_SOLO = ["ETv", "PÁT", "MAN", "REF", "SIN", "FOg", "SDo", "DOC"];

/** O cavalo 11 a 20 anda em conjunto; o 21 a 25 está solto. */
export function cavaloEmConjunto(cavalo: number): boolean {
  return cavalo >= 11 && cavalo <= 20;
}

export type LancamentoDoMovimento = { diasAtras: number; sigla: string };

/**
 * Os lançamentos recentes de um cavalo (anteontem, ontem e hoje), com siglas diferentes de um dia para o
 * outro e de um cavalo para o outro. Só siglas que a régua aceita para conjunto ou para solo.
 */
export function roteiroDoMovimento(cavalo: number): LancamentoDoMovimento[] {
  if (cavalo < 11 || cavalo > 25) {
    throw new ErroDoEixo("O movimento recente vai do cavalo 11 ao 25.");
  }
  const siglas = cavaloEmConjunto(cavalo) ? SIGLAS_DE_CONJUNTO : SIGLAS_SOLO;
  return [2, 1, 0].map((diasAtras, k) => ({
    diasAtras,
    sigla: siglas[(cavalo * 3 + k * 2) % siglas.length]!,
  }));
}

/** Número de cada placa e CR que os cenários usam (acima dos 50 da frota base, para não colidir). */
export const NUMEROS_DOS_CENARIOS = {
  placaComDoisCr: { placa: 58, crAtual: 58, crDuplicado: 158 },
  placaComFrotaEAcionista: { placa: 57, crFrota: 57, crAcionista: 157 },
  placaDeCadastroIncompleto: { placa: 59, cr: 59 },
  placaSemCr: { placa: 60, cr: 60 },
  operacaoDemo: { placaInicial: 61, placas: 8, crsDeServico: [161, 162] },
  crDeServicoSemOperacao: 163,
  crQueDivergeDaUnidade: 164,
  // Nível 1 (13/11/2026): Trocar CR, baixa com quatro olhos e lançamento sem CR conhecido.
  placaDaTrocaDeCr: { placa: 70, crAntigo: 70, crNovo: 170 },
  placaDaBaixaPedida: { placa: 71, cr: 71 },
  centroSemCr: "9909999",
} as const;

/** Cidades FICTÍCIAS da demonstração (ids acima de 9.900.000; a tabela real vem da cópia da v1). */
export const CIDADES_DA_DEMO = [
  { id: 9_900_001, nome: "Cidade Demo Norte", uf: "MA", latitude: -2.53, longitude: -44.3 },
  { id: 9_900_002, nome: "Cidade Demo Porto", uf: "MA", latitude: -2.57, longitude: -44.37 },
  { id: 9_900_003, nome: "Cidade Demo Serra", uf: "PA", latitude: -6.07, longitude: -49.9 },
  { id: 9_900_004, nome: "Cidade Demo Sul", uf: "SP", latitude: -22.5, longitude: -47.4 },
  { id: 9_900_005, nome: "Cidade Demo Sem Mapa", uf: "MA", latitude: null, longitude: null },
] as const;

/** A posição de ontem do i-ésimo conjunto do gestor Demo: uma cidade da demonstração, ou "sem sinal" (o 5º). */
export function posicaoDeOntem(i: number): { cidadeId: number | null; semSinal: boolean } {
  if (i % 5 === 4) return { cidadeId: null, semSinal: true };
  return { cidadeId: CIDADES_DA_DEMO[i % 4]!.id, semSinal: false };
}
