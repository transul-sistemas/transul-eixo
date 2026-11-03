#!/usr/bin/env bash
# Lê os arquivos mudados (um por linha, na entrada) e responde "true" se o e2e pode ser pulado: todos
# estão em docs/ ou supabase/, ou terminam em .md. Sem arquivos (ou sem como saber), "false": roda tudo.
# Usado pelo workflow de verificação e testado em lib/qualidade/workflow-verificacao.test.ts.
set -euo pipefail

arquivos="$(grep -v '^[[:space:]]*$' || true)"

if [ -n "$arquivos" ] && ! printf '%s\n' "$arquivos" | grep -qvE '^(docs/|supabase/)|\.md$'; then
  echo true
else
  echo false
fi
