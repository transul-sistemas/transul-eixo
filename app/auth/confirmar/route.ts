import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_DE_ATIVIDADE } from "@/lib/seguranca/inatividade";
import { caminhoInterno } from "@/lib/seguranca/redirecionamento";
import { opcoesDoCookie } from "@/lib/supabase/cookies";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";

// O link do e-mail de recuperação (fluxo PKCE com token_hash, docs "Password-based Auth"): confere o
// token e leva ao "proximo" (só caminho interno). Link inválido ou vencido volta a /entrar com o motivo.
const TIPOS_ACEITOS: readonly EmailOtpType[] = ["recovery"];

export async function GET(pedido: NextRequest) {
  const busca = pedido.nextUrl.searchParams;
  const token = busca.get("token_hash");
  const tipo = busca.get("type") as EmailOtpType | null;
  // Sem caminho interno, a raiz: o proxy leva à primeira tela do perfil.
  const destino = caminhoInterno(busca.get("proximo")) ?? "/";

  if (token && tipo && TIPOS_ACEITOS.includes(tipo)) {
    const supabase = await criarClienteDoServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: token });
    if (!error) {
      // A sessão nasce aqui (sem passar pela tela de entrar): a marca de atividade nasce junto.
      const resposta = NextResponse.redirect(new URL(destino, pedido.url));
      resposta.cookies.set(COOKIE_DE_ATIVIDADE, String(Date.now()), opcoesDoCookie({ path: "/" }));
      return resposta;
    }
  }
  return NextResponse.redirect(new URL("/entrar?motivo=link-invalido", pedido.url));
}
