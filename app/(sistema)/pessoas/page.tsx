import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/pessoas">) {
  return <IrParaOModulo modulo="pessoas" searchParams={searchParams} />;
}
