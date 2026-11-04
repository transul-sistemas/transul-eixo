// `pnpm env:local`: grava em .env.local (fora do Git) o endereço e a chave publicável do Supabase LOCAL,
// lidos do `supabase status`. Nunca imprime valores; nunca grava a chave secreta. As outras linhas do
// .env.local são mantidas.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ARQUIVO = ".env.local";
const MAPA = {
  API_URL: "NEXT_PUBLIC_SUPABASE_URL",
  PUBLISHABLE_KEY: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
};

const status = execSync("pnpm exec supabase status -o env", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const lidas = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((linha) => /^([A-Z_]+)="?(.*?)"?$/.exec(linha))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const faltam = Object.keys(MAPA).filter((nome) => !lidas[nome]);
if (faltam.length > 0) {
  console.error(`O supabase status não trouxe ${faltam.join(", ")}. O Supabase local está ligado?`);
  process.exit(1);
}

const atuais = existsSync(ARQUIVO) ? readFileSync(ARQUIVO, "utf8").split(/\r?\n/) : [];
const mantidas = atuais.filter(
  (linha) => linha && !Object.values(MAPA).some((nome) => linha.startsWith(`${nome}=`)),
);
const novas = Object.entries(MAPA).map(([origem, destino]) => `${destino}=${lidas[origem]}`);
writeFileSync(ARQUIVO, [...mantidas, ...novas].join("\n") + "\n", "utf8");
console.log(`${ARQUIVO} atualizado com ${Object.values(MAPA).join(" e ")} (Supabase local).`);
