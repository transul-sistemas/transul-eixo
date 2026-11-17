import { NextResponse } from "next/server";
import { montarCsv } from "@/components/formato/csv";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { exportarLista } from "@/lib/exportacao/exportadores";
import { textoDoErro } from "@/lib/log/erro";
import { todasAsTelas } from "@/lib/navegacao/catalogo";
import { ehLista, nomeDoArquivoCsv } from "@/lib/navegacao/exportacao";
import { podeAbrir } from "@/lib/navegacao/visibilidade";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

// Exportar CSV de uma lista do catálogo (`/exportar/<id da tela>?<filtros da tela>`), pelo servidor: a
// sessão de quem pede (a RLS decide o que entra), a tela tem de estar aberta ao perfil, a lista inteira
// (não só a página). Sem formatação à mão: os textos vêm de components/formato/ e o CSV de montarCsv.

export async function GET(pedido: Request, { params }: { params: Promise<{ tela: string }> }) {
  const { tela: id } = await params;
  const sessao = await exigirSessao();
  const tela = todasAsTelas().find((t) => t.id === id);
  if (!tela || !ehLista(id) || !podeAbrir(sessao.perfil, tela)) {
    return new NextResponse("Esta lista não existe ou não está aberta ao seu perfil.", {
      status: 404,
    });
  }
  const hoje = hojeEmSaoPaulo(new Date());
  try {
    const arquivo = await exportarLista(id, new URL(pedido.url).searchParams, hoje);
    return new NextResponse(montarCsv(arquivo.cabecalho, arquivo.linhas), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${nomeDoArquivoCsv(id, hoje)}"`,
        "cache-control": "no-store",
        ...(arquivo.cortada ? { "x-eixo-cortado": "sim" } : {}),
      },
    });
  } catch (erro) {
    console.error(`exportar ${id} falhou:`, textoDoErro(erro));
    return new NextResponse("Não foi possível exportar agora. Tente de novo.", { status: 500 });
  }
}
