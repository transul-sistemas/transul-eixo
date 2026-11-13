# Ficha: Pessoas › Diárias e premiação

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quanto se paga de diária e premiação no período?
2. **Quem usa e que decisão toma:** Pessoas e Diretoria: conferem antes de pagar.
3. **A ação principal e as ações de cada estado:** Ler; chips com e sem premiação. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.diarias_e_premiacao".
4. **O elemento de assinatura:** Diárias e premiações por operação e por campanha.
5. **De onde vem o número:** `nucleo.diarias_e_premiacao` (uma função por tela, totais prontos). Escala do mês × parâmetro de diária; premiação pelas campanhas (regras a confirmar).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.diarias_e_premiacao" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** diárias da v1 (a confirmar).
8. **Por que a tela não é uma tabela comum:** Junta dias trabalhados, diária e prêmio por pessoa. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/pessoas/diarias-e-premiacao`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
