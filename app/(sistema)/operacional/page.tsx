import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/operacional">) {
  return <IrParaOModulo modulo="operacional" searchParams={searchParams} />;
}
