#!/usr/bin/env bash
# Instala o Chromium do Playwright (com as dependências do sistema) com nova tentativa.
# Motivo (11/11/2026): o runner do GitHub às vezes não resolve os endereços do apt
# ("Temporary failure resolving"), e o job inteiro caía antes de qualquer teste. A falha é de rede,
# passageira: o apt tenta de novo sozinho e o script repete a instalação com espera crescente.
# O navegador em si já vem do cache de ~/.cache/ms-playwright (passo anterior do workflow).
set -uo pipefail

echo 'Acquire::Retries "5";' | sudo tee /etc/apt/apt.conf.d/80-tentar-de-novo >/dev/null

total=4
for tentativa in $(seq 1 "$total"); do
  if pnpm exec playwright install --with-deps chromium; then
    exit 0
  fi
  espera=$((tentativa * 30))
  echo "Instalação do Chromium falhou (tentativa ${tentativa} de ${total}); nova tentativa em ${espera}s."
  sleep "$espera"
done

echo "Instalação do Chromium falhou nas ${total} tentativas: veja os erros de rede acima."
exit 1
