# Ficha: Parceiros › Livro do acionista

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quanto cada acionista tem a receber no mês?
2. **Quem usa e que decisão toma:** Diretoria e Financeiro.
3. **A ação principal e as ações de cada estado:** Ler; chips créditos e débitos. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.livro_do_acionista".
4. **O elemento de assinatura:** Saldo por acionista com créditos e débitos.
5. **De onde vem o número:** `nucleo.livro_do_acionista` (uma função por tela, totais prontos). Conciliação do mês e saldo acumulado (a calcular no banco).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.livro_do_acionista" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** livro da v1.
8. **Por que a tela não é uma tabela comum:** Livro com saldo, não só lançamentos. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/parceiros/livro-do-acionista`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
