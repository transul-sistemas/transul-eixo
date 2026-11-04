import { redirect } from "next/navigation";
import { Suspense } from "react";
import { destinoInicial } from "@/lib/seguranca/redirecionamento";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

// A raiz leva à primeira tela do perfil (aprovação da 3.8). O proxy já decide isso antes; esta página
// é a segunda barreira. Ler a sessão é dinâmico, então fica num Suspense.
async function Destino(): Promise<never> {
  const { perfil } = await exigirSessao();
  redirect(destinoInicial(perfil));
}

export default function Raiz() {
  return (
    <Suspense fallback={null}>
      <Destino />
    </Suspense>
  );
}
