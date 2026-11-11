// Dados congelados: o staging vai só até uma data (nucleo.dados_do_staging_ate). O mês dessa data é
// incompleto, a menos que ela seja o último dia dele. Regra pura sobre texto `aaaa-mm-dd`, sem fuso;
// quem decide a data é o banco.

const DATA = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** O mês (`aaaa-mm`) que ainda está incompleto na data limite, ou nulo se não há mês incompleto. */
export function mesIncompleto(dadosAte: string | null | undefined): string | null {
  const achado = DATA.exec(dadosAte ?? "");
  if (!achado) return null;
  const ano = Number(achado[1]);
  const mes = Number(achado[2]);
  const dia = Number(achado[3]);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia > ultimoDia || dia === ultimoDia) return null;
  return `${achado[1]}-${achado[2]}`;
}

export function ehMesIncompleto(mes: string, dadosAte: string | null | undefined): boolean {
  return mesIncompleto(dadosAte) === mes;
}
