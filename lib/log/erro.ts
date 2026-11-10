// O que um log mostra de um erro (Lote 2, 10/11/2026): o código (SQLSTATE ou do PostgREST) e o nome,
// nunca message, details nem hint do banco (que podem trazer placa, nome ou documento). A mensagem só sai
// quando o texto é nosso: ErroDoEixo e as classes que o estendem. Sem import com alias: os scripts rodam
// este arquivo direto no Node (só tirando os tipos).

/** Erro cujo texto é escrito por nós (nunca copiado do banco): o log pode mostrá-lo inteiro. */
export class ErroDoEixo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

// SQLSTATE (23505), PostgREST (PGRST116) ou o código do Auth (weak_password): nunca texto livre.
const CODIGO = /^[0-9A-Z]{5}$|^PGRST\d{3}$|^[a-z]+(?:_[a-z]+)+$/;

export function textoDoErro(erro: unknown): string {
  if (erro instanceof ErroDoEixo) return erro.message;
  const codigo =
    typeof erro === "object" && erro !== null && "code" in erro && typeof erro.code === "string"
      ? erro.code
      : undefined;
  const comCodigo = codigo !== undefined && CODIGO.test(codigo) ? `código ${codigo}` : undefined;
  if (erro instanceof Error) return comCodigo ? `${erro.name}, ${comCodigo}` : erro.name;
  return comCodigo ?? "erro sem detalhe";
}
