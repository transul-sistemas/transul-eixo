import { connection } from "next/server";
import { Suspense } from "react";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import { ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerPatio } from "@/lib/dados/operacional";
import { acharTela } from "@/lib/navegacao/catalogo";
import { RegistrarChegada } from "./registrar-chegada";

export const metadata = metadataDaTela("/operacional/totem");

async function Conteudo() {
  // O modo dos dados é lido a cada pedido (sem pré-renderizar a tela com o modo do build).
  await connection();
  return modoDosDados() !== "banco" ? (
    <ListaVazia
      titulo="O Totem grava só no banco"
      descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para registrar a chegada na fila."
    />
  ) : (
    <>
      <Indicadores />
      <RegistrarChegada />
    </>
  );
}

/** A fila agora (contagens prontas do banco, as mesmas do Pátio), para quem está no totem. */
async function Indicadores() {
  const { contagens: c } = await lerPatio({ filtro: "fila", pagina: 1, tam: 20 });
  return (
    <div className="mb-4">
      <FaixaDeKpis
        kpis={[
          { id: "fila", rotulo: "Na fila agora", valor: formatarInteiro(c.fila) },
          { id: "dop", rotulo: "Chegaram ao pátio (DOp)", valor: formatarInteiro(c.DOp) },
          { id: "carregando", rotulo: "Carregando", valor: formatarInteiro(c.CAr + c.CAn) },
        ]}
      />
    </div>
  );
}

export default function Pagina() {
  const tela = acharTela("/operacional/totem")?.tela;
  return (
    <PaginaDeLeitura titulo={tela?.nome ?? "Totem"} descricao={tela?.descricao}>
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Suspense fallback={null}>
          <Conteudo />
        </Suspense>
      </div>
    </PaginaDeLeitura>
  );
}
