import { NextResponse } from "next/server";
import { montarCsv } from "@/components/formato/csv";
import { formatarData, hojeEmSaoPaulo } from "@/components/formato/data";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerTodasAsExcecoes } from "@/lib/dados/tarefas";
import { ehExcecaoDaDemonstracao } from "@/lib/dominio/excecoes-da-demonstracao";
import { nomeDoAssunto } from "@/lib/dominio/tarefas";
import { textoDoErro } from "@/lib/log/erro";
import { lerFila } from "@/lib/navegacao/excecoes";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

// Exportar a fila de exceções em CSV, pelo servidor: o mesmo filtro da tela (tipo e Demo), a fila inteira
// (não só a página), com a sessão de quem pede (a RLS decide o que entra). Sem formatação à mão: a data
// sai de components/formato/ e o CSV de components/formato/csv.ts.

export async function GET(pedido: Request) {
  await exigirSessao();
  if (modoDosDados() !== "banco") {
    return new NextResponse("As Exceções leem só do banco.", { status: 409 });
  }
  const parametros = new URL(pedido.url).searchParams;
  const estado = lerFila(parametros);
  const soDemo = parametros.get("demo") === "1";
  try {
    const todas = await lerTodasAsExcecoes(estado.assunto);
    const linhas = soDemo ? todas.linhas.filter(ehExcecaoDaDemonstracao) : todas.linhas;
    const csv = montarCsv(
      ["Placa", "Pessoa", "CR", "Tipo", "O que falta", "Desde"],
      linhas.map((l) => [
        l.placa,
        l.pessoaNome,
        l.cr,
        nomeDoAssunto(l.assunto),
        l.descricao,
        formatarData(l.criadoEm),
      ]),
    );
    const nome = `excecoes-${hojeEmSaoPaulo(new Date())}${soDemo ? "-demo" : ""}.csv`;
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${nome}"`,
        "cache-control": "no-store",
        ...(todas.cortada ? { "x-eixo-cortado": "sim" } : {}),
      },
    });
  } catch (erro) {
    console.error("exportar exceções falhou:", textoDoErro(erro));
    return new NextResponse("Não foi possível exportar agora. Tente de novo.", { status: 500 });
  }
}
