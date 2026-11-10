"use client";

import { ErroDaTelaDeParceiros } from "../erro-da-tela";

export default function ErroDaConciliacao(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDaTelaDeParceiros titulo="Conciliação" oQue="a conciliação" {...props} />;
}
