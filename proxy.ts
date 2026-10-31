import { type NextRequest, NextResponse } from "next/server";
import { decidirFicha } from "@/lib/navegacao/proxy-da-ficha";

// O proxy só confere o formato da placa na ficha; nada de dado, nada de sessão. Placa mal escrita
// vira 404 de verdade (a página inexistente do sistema), antes de a rota renderizar.
export function proxy(pedido: NextRequest) {
  if (decidirFicha(pedido.nextUrl.pathname) === "nao-encontrada") {
    return NextResponse.rewrite(new URL("/nao-encontrada", pedido.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/frota/placas/:placa"] };
