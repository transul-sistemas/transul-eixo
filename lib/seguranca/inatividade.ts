// Sair por inatividade de 8 horas (decisão de Alexandre, 03/11/2026). O limite de inatividade da sessão
// do Supabase só existe do plano Pro em diante (docs "User sessions"); no Free, o Eixo confere no proxy:
// a cada pedido com sessão, a marca de atividade (cookie httpOnly) é lida e renovada.

export const LIMITE_DE_INATIVIDADE_MS = 8 * 60 * 60 * 1000;
export const COOKIE_DE_ATIVIDADE = "eixo_ultima_atividade";

/** A marca do cookie: nula se não existe; NaN se ilegível. */
export function lerUltimaAtividade(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  return /^\d+$/.test(valor) ? Number(valor) : Number.NaN;
}

/** [última, última + 8 h): no limite exato, expirou. Marca ilegível ou do futuro conta como expirada. */
export function expirouPorInatividade(ultima: number | null, agora: number): boolean {
  if (ultima === null) return false;
  if (!Number.isFinite(ultima) || ultima > agora) return true;
  return agora - ultima >= LIMITE_DE_INATIVIDADE_MS;
}
