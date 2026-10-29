import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/frota">) {
  return <IrParaOModulo modulo="frota" searchParams={searchParams} />;
}
