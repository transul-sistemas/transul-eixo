"use client";

import { useState } from "react";
import { CampoMoeda } from "@/components/formato/moeda";

export function CampoDeExemplo() {
  const [centavos, setCentavos] = useState(0);
  return <CampoMoeda rotulo="Valor do frete" valor={centavos} onChange={setCentavos} />;
}
