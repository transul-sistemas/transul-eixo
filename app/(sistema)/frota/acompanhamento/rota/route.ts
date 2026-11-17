import { NextResponse } from "next/server";
import { z } from "zod";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerSerieDePosicoes } from "@/lib/dados/posicao-do-dia";
import type { PontoDaRota } from "@/lib/dominio/rota-do-mes";
import { textoDoErro } from "@/lib/log/erro";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

// A4 · Rota do mês (aba da barra lateral do Acompanhamento): a série de posições da placa no mês, lida de
// nucleo.serie_de_posicoes com a sessão de quem pede (a RLS decide o alcance). Só leitura; o proxy já
// conferiu Frota › ver. Fora do banco (exemplo), uma série fictícia marcada como exemplo.

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PEDIDO = z.object({
  ativo: z
    .string()
    .uuid()
    .or(z.string().regex(/^[\w-]{1,60}$/)),
  de: DIA,
  ate: DIA,
});

function serieDeExemplo(ativo: string, de: string, ate: string): PontoDaRota[] {
  const pontos: PontoDaRota[] = [];
  const fim = Date.parse(`${ate}T12:00:00Z`);
  let cidade = 1 + (ativo.length % 4);
  for (let t = Date.parse(`${de}T12:00:00Z`), i = 0; t <= fim; t += 86_400_000, i++) {
    const dia = new Date(t).toISOString().slice(0, 10);
    if (i % 4 === 3) cidade = 1 + ((cidade + 1) % 5);
    pontos.push(
      i % 9 === 8
        ? { dia, cidade: null, uf: null, semSinal: true }
        : { dia, cidade: `Cidade Demo ${cidade}`, uf: "SP", semSinal: false },
    );
  }
  return pontos;
}

export async function GET(pedido: Request) {
  await exigirSessao();
  const url = new URL(pedido.url);
  const entrada = PEDIDO.safeParse({
    ativo: url.searchParams.get("ativo"),
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
  });
  if (!entrada.success || entrada.data.de > entrada.data.ate) {
    return NextResponse.json({ erro: "Pedido inválido: placa ou período." }, { status: 400 });
  }
  const { ativo, de, ate } = entrada.data;
  if (modoDosDados() !== "banco") {
    return NextResponse.json({ origem: "exemplo", pontos: serieDeExemplo(ativo, de, ate) });
  }
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    const serie = await lerSerieDePosicoes(cliente, ativo, de, ate);
    const pontos: PontoDaRota[] = serie.map((p) => ({
      dia: p.dia,
      cidade: p.cidade,
      uf: p.uf,
      semSinal: p.sem_sinal,
    }));
    return NextResponse.json(
      { origem: "banco", pontos },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    console.error("rota do mês falhou:", textoDoErro(erro));
    return NextResponse.json({ erro: "Não foi possível ler a rota agora." }, { status: 500 });
  }
}
