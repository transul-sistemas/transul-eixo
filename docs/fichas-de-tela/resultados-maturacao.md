# Ficha: Resultados › Maturação

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quanto da dívida antiga (negociada de 01/05/2025 a 31/05/2026) já foi quitado?
2. **Quem usa e que decisão toma:** Diretoria: acompanha a quitação e onde ainda há saldo.
3. **A ação principal e as ações de cada estado:** Ler; chips por situação (quitado, pago em parte, em aberto). Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.maturacao_da_divida".
4. **O elemento de assinatura:** A curva de pagamento mês a mês e o saldo por operação.
5. **De onde vem o número:** `nucleo.maturacao_da_divida` (uma função por tela, totais prontos). Títulos do Sankhya; renegociado herda a menor DTNEG de origem (glossário).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.maturacao_da_divida" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** maturação da v1.
8. **Por que a tela não é uma tabela comum:** Une título, pagamento e saldo por situação, com a curva de quitação. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/resultados/maturacao`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
