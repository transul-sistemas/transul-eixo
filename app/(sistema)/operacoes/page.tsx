import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/operacoes">) {
  return <IrParaOModulo modulo="operacoes" searchParams={searchParams} />;
}
