// As opções de todo cookie que o Eixo grava para a sessão (decisão de Alexandre, 03/11/2026):
// httpOnly (o JavaScript da página não lê), Secure (só HTTPS; o navegador aceita em localhost),
// SameSite=Lax e cookie de sessão, sem prazo (sem "lembrar de mim"). Apagar (maxAge 0) continua valendo.

export interface OpcoesDoCookie {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
}

export function opcoesDoCookie(opcoes: OpcoesDoCookie = {}): OpcoesDoCookie {
  const resto = { ...opcoes };
  delete resto.expires;
  delete resto.maxAge;
  return {
    ...resto,
    ...(opcoes.maxAge === 0 ? { maxAge: 0 } : {}),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  };
}
