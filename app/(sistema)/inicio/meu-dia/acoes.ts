"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { modoDosDados } from "@/lib/dados/fonte";
import { registrarPlacaSemCr } from "@/lib/dados/meu-dia";
import { textoDoErro } from "@/lib/log/erro";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";

// Meu dia › Receber placas: a única escrita própria do lote. Depois de aceitar uma placa sem CR vigente,
// abre a exceção "placa sem CR" na fila (função atômica, com chave de envio). Fina: confere a permissão,
// valida a entrada com Zod e deixa o banco conferir quem chama (só o gestor de destino).

const ENTRADA = z.object({
  chaveDeEnvio: z.string().refine(chaveDeEnvioValida, "Chave de envio inválida."),
  dados: z.object({ pedidoId: z.string().uuid() }),
});

export async function registrarPlacaSemCrAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<{ pedidoId: string }>> {
  try {
    await exigirPermissao({ modulo: "frota", acao: "editar" });
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
  const entrada = ENTRADA.safeParse(bruto);
  if (!entrada.success) {
    return erroDaAcao("entrada_invalida", {
      mensagem: "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.",
    });
  }
  // No modo exemplo não há fila no banco: nada a abrir.
  if (modoDosDados() !== "banco") return sucesso({ pedidoId: entrada.data.dados.pedidoId });
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    const r = await registrarPlacaSemCr(
      cliente,
      entrada.data.dados.pedidoId,
      entrada.data.chaveDeEnvio,
    );
    if (r.ok) {
      revalidatePath("/frota/excecoes");
      revalidatePath("/inicio/tarefas");
    }
    return r;
  } catch (erro) {
    console.error("registrar placa sem CR falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
}
