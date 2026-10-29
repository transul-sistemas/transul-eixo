import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/parceiros">) {
  return <IrParaOModulo modulo="parceiros" searchParams={searchParams} />;
}
