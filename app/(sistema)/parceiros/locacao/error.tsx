"use client";

import { ErroDaTelaDeParceiros } from "../erro-da-tela";

export default function ErroDaLocacao(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDaTelaDeParceiros titulo="Locação" oQue="as locações" {...props} />;
}
