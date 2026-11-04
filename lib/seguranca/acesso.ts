// A decisão do proxy a cada pedido (fatia 3.8). Pura: quem lê a sessão e o banco é o proxy.ts.
//  * rota pública (entrar, esqueci a senha, confirmação do e-mail) passa;
//  * sem sessão vai para /entrar levando o caminho de volta; inatividade sai e vai para /entrar;
//  * logado sem vínculo (ou vínculo inativo) vai para "acesso não liberado";
//  * sem permissão de ver o módulo (config.pode, lida do banco a cada pedido) é 404.

import type { IdDoModulo } from "@/lib/navegacao/catalogo";
import { DESTINO_PADRAO } from "./redirecionamento";

const ROTAS_PUBLICAS = ["/entrar", "/esqueci-a-senha", "/auth/confirmar"];
const ROTAS_SEM_VINCULO = ["/acesso-nao-liberado", "/nova-senha"];
const MODULOS: readonly IdDoModulo[] = [
  "inicio",
  "frota",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "cadastros",
  "admin",
];

const casa = (caminho: string, rota: string) => caminho === rota || caminho.startsWith(`${rota}/`);

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((r) => casa(caminho, r));
}

export function moduloDoCaminho(caminho: string): IdDoModulo | null {
  const primeiro = caminho.split("/")[1] ?? "";
  return (MODULOS as readonly string[]).includes(primeiro) ? (primeiro as IdDoModulo) : null;
}

export interface EstadoDoPedido {
  temUsuario: boolean;
  temVinculo?: boolean;
  podeVerModulo?: boolean;
  inativo?: boolean;
}

export type Decisao =
  | { tipo: "seguir" }
  | { tipo: "redirecionar"; para: string }
  | { tipo: "sair"; para: string }
  | { tipo: "nao-encontrada" };

export function decidirAcesso(caminho: string, busca: string, estado: EstadoDoPedido): Decisao {
  const voltar = encodeURIComponent(`${caminho}${busca}`);
  if (rotaPublica(caminho)) {
    return estado.temUsuario && casa(caminho, "/entrar") && !estado.inativo
      ? { tipo: "redirecionar", para: DESTINO_PADRAO }
      : { tipo: "seguir" };
  }
  if (!estado.temUsuario) return { tipo: "redirecionar", para: `/entrar?proximo=${voltar}` };
  if (estado.inativo) return { tipo: "sair", para: `/entrar?motivo=inatividade&proximo=${voltar}` };
  if (!estado.temVinculo) {
    return ROTAS_SEM_VINCULO.some((r) => casa(caminho, r))
      ? { tipo: "seguir" }
      : { tipo: "redirecionar", para: "/acesso-nao-liberado" };
  }
  if (casa(caminho, "/acesso-nao-liberado")) return { tipo: "redirecionar", para: DESTINO_PADRAO };
  if (moduloDoCaminho(caminho) && !estado.podeVerModulo) return { tipo: "nao-encontrada" };
  return { tipo: "seguir" };
}
