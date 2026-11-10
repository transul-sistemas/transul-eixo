// `pnpm db:dev-dados` (cerca de 200 ativos) e `pnpm db:carga` (5.000; a medição é o db-diagnostico.ts):
// os dados de desenvolvimento do supabase/dev/dados.sql, SÓ no Supabase LOCAL. Recusa qualquer banco
// que não seja da própria máquina (nunca produção). Nunca imprime endereço nem chave: lê o
// `supabase status` por dentro. Fatia 3.9a.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";

import { bancoLocal, enderecoDoBancoLocal } from "./banco-local.ts";
import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";

export { bancoLocal };

/** `--quantidade 5000` (200 por padrão) e `--sem-gatilhos` (só para medir a carga em lote). */
export function lerArgumentos(argv: readonly string[]): {
  quantidade: number;
  semGatilhos: boolean;
} {
  const i = argv.indexOf("--quantidade");
  const quantidade = Number(i >= 0 ? (argv[i + 1] ?? "") : "200");
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20000) {
    throw new ErroDoEixo("--quantidade vai de 1 a 20000.");
  }
  return { quantidade, semGatilhos: argv.includes("--sem-gatilhos") };
}

/** As tabelas com o gatilho da leitura mantida (supabase/migrations, fatia 3.9a). */
const TABELAS_COM_GATILHO = [
  "ativo",
  "placa_do_ativo",
  "gestor_da_carteira",
  "cr_do_ativo",
  "placa_na_operacao",
  "custodia",
  "estado_de_status",
  "composicao",
  "cr",
  "pessoa",
  "operacao",
];

async function principal() {
  const argumentos = lerArgumentos(process.argv.slice(2));
  const endereco = enderecoDoBancoLocal();
  if (!bancoLocal(endereco)) {
    throw new ErroDoEixo("Recusado: os dados de desenvolvimento só rodam no Supabase local.");
  }
  const cliente = new pg.Client({ connectionString: endereco });
  await cliente.connect();
  try {
    const inicio = performance.now();
    await cliente.query("begin");
    await cliente.query(readFileSync("supabase/dev/dados.sql", "utf8"));
    // Só para medir a carga em lote: sem os gatilhos, a leitura mantida é reconstruída no fim, na
    // mesma transação, e os gatilhos voltam antes do commit.
    if (argumentos.semGatilhos) {
      for (const tabela of TABELAS_COM_GATILHO) {
        await cliente.query(`alter table nucleo.${tabela} disable trigger t99_leitura_da_placa`);
      }
    }
    const { rows } = await cliente.query<{ resumo: string }>(
      "select pg_temp.gerar_dados($1) as resumo",
      [argumentos.quantidade],
    );
    if (argumentos.semGatilhos) {
      await cliente.query("select nucleo.reconstruir_leitura_das_placas()");
      // Os gatilhos de negócio adiados (cobertura, evento inicial...) disparam agora: com evento
      // pendente, o ALTER TABLE que religa os gatilhos da leitura é recusado.
      await cliente.query("set constraints all immediate");
      for (const tabela of TABELAS_COM_GATILHO) {
        await cliente.query(`alter table nucleo.${tabela} enable trigger t99_leitura_da_placa`);
      }
    } else {
      // Com os gatilhos, o recálculo é adiado ao fim da transação: entra na medida.
      await cliente.query("set constraints all immediate");
    }
    await cliente.query("commit");
    const segundos = Math.round((performance.now() - inicio) / 1000);
    const modo = argumentos.semGatilhos
      ? "sem os gatilhos (reconstrução no fim)"
      : "com os gatilhos";
    console.log(
      `Dados de desenvolvimento: ${rows[0]!.resumo} Gerados em ${segundos} s, ${modo}` +
        ` (${Math.round((performance.now() - inicio) / argumentos.quantidade)} ms por ativo).`,
    );
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(textoDoErro(erro));
    process.exit(1);
  });
}
