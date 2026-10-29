import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/inicio">) {
  return <IrParaOModulo modulo="inicio" searchParams={searchParams} />;
}
