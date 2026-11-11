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

/** CODCENCUS do CR fictício número n (1 a 100): raiz 2, 4 ou 6 e 990nnn, nunca de 8 dígitos. */
export function codcencusDemo(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new ErroDoEixo("O CR da demonstração vai do número 1 ao 100.");
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
