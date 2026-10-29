import { IrParaOModulo } from "@/components/navegacao/ir-para-o-modulo";

export default function Modulo({ searchParams }: PageProps<"/cadastros">) {
  return <IrParaOModulo modulo="cadastros" searchParams={searchParams} />;
}
