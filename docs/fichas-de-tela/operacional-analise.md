# Ficha: Operacional › Análise

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quanto tempo a placa fica em cada etapa do pátio?
2. **Quem usa e que decisão toma:** Operacional e Diretoria: atacam a etapa mais lenta por filial.
3. **A ação principal e as ações de cada estado:** Ler; chips por filial. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.analise_do_operacional".
4. **O elemento de assinatura:** Tempo médio de DOp, ACe, CAr e CAn por filial e o ciclo até ETc.
5. **De onde vem o número:** `nucleo.analise_do_operacional` (uma função por tela, totais prontos). Eventos de status e ordens de carregamento, duração calculada no banco.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.analise_do_operacional" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Mede o tempo entre siglas da régua, não só conta ordens. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/operacional/analise`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
