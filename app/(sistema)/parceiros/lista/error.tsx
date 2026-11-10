"use client";

import { ErroDaTelaDeParceiros } from "../erro-da-tela";

export default function ErroDosParceiros(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDaTelaDeParceiros titulo="Parceiros" oQue="os parceiros" {...props} />;
}
