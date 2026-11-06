// O banco LOCAL (o Supabase no Docker da própria máquina), para os scripts de carga: dados de
// desenvolvimento (3.9a) e importações (3.9c). Recusa qualquer outro banco (nunca a nuvem). O endereço
// vem do `supabase status` lido por dentro e nunca é impresso.
import { execSync } from "node:child_process";

/** Só o banco da própria máquina (o Supabase local no Docker). */
export function bancoLocal(endereco: string): boolean {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return false;
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return false;
  return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

export function enderecoDoBancoLocal(): string {
  const texto = execSync("pnpm exec supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const linha = texto.split(/\r?\n/).find((l) => l.startsWith("DB_URL="));
  const endereco = linha?.replace(/^DB_URL="?/, "").replace(/"$/, "");
  if (!endereco)
    throw new Error("O supabase status não trouxe o banco: o Supabase local está ligado?");
  return endereco;
}
