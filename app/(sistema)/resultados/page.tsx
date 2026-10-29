import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/resultados">) {
  return <IrParaOModulo modulo="resultados" searchParams={searchParams} />;
}
