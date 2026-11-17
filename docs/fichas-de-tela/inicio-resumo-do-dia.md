# Ficha: Início › Resumo do dia

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Como a operação está hoje, numa página?
2. **Quem usa e que decisão toma:** Todos os perfis: começam o dia pelo que pede atenção.
3. **A ação principal e as ações de cada estado:** Ler; o olho leva à ficha da placa. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.resumo_do_dia".
4. **O elemento de assinatura:** A régua inteira com a contagem de cada sigla.
5. **De onde vem o número:** `nucleo.resumo_do_dia` (uma função por tela, totais prontos). Leituras do Acompanhamento, do Pátio e da Carteira (função única proposta).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.resumo_do_dia" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Prioriza o que está parado ou impedido há mais tempo. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/inicio/resumo-do-dia`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
