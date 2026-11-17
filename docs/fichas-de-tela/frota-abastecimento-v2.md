# Ficha: Frota › Abastecimento (v2)

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Que abastecimento ainda não chegou do Sankhya e foi lançado à mão?
2. **Quem usa e que decisão toma:** Gestor de frota.
3. **A ação principal e as ações de cada estado:** **Lançar abastecimento** (popup, marcado provisório; Ctrl+K). Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.abastecimentos_provisorios".
4. **O elemento de assinatura:** Os lançados à mão à parte: nunca somam no total do Sankhya.
5. **De onde vem o número:** `nucleo.abastecimentos_provisorios` (uma função por tela, totais prontos). Grava: nucleo.lancar_abastecimento_provisorio (n2-banco, em construção); leitura: abastecimento_do_mes_v2.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.abastecimentos_provisorios" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Separa o provisório do fato e o confere depois. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/frota/abastecimento`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
