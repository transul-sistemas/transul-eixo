import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { caminhoInterno } from "@/lib/seguranca/redirecionamento";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";

// O link do e-mail de recuperação (fluxo PKCE com token_hash, docs "Password-based Auth"): confere o
// token e leva ao "proximo" (só caminho interno). Link inválido ou vencido volta a /entrar com o motivo.
const TIPOS_ACEITOS: readonly EmailOtpType[] = ["recovery"];

export async function GET(pedido: NextRequest) {
  const busca = pedido.nextUrl.searchParams;
  const token = busca.get("token_hash");
  const tipo = busca.get("type") as EmailOtpType | null;
  const destino = caminhoInterno(busca.get("proximo"));

  if (token && tipo && TIPOS_ACEITOS.includes(tipo)) {
    const supabase = await criarClienteDoServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: token });
    if (!error) return NextResponse.redirect(new URL(destino, pedido.url));
  }
  return NextResponse.redirect(new URL("/entrar?motivo=link-invalido", pedido.url));
}
