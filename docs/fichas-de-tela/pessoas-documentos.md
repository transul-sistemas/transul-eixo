# Ficha: Pessoas › Documentos

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Que documento vence nas próximas semanas?
2. **Quem usa e que decisão toma:** Pessoas: renova antes de vencer.
3. **A ação principal e as ações de cada estado:** Ler; chips válido, a vencer em 30 dias, vencido. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.documentos_das_pessoas".
4. **O elemento de assinatura:** Vencimentos por semana.
5. **De onde vem o número:** `nucleo.documentos_das_pessoas` (uma função por tela, totais prontos). Tabela de documentos em pessoas, com RLS (dado sensível).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.documentos_das_pessoas" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Ordena pelo vencimento e conta por semana. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/pessoas/documentos`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
