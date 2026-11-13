# Ficha: Resultados › Por operação

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quanto cada operação deixou no mês, da receita à margem?
2. **Quem usa e que decisão toma:** Diretoria: confere o mês antes de fechar.
3. **A ação principal e as ações de cada estado:** Ler e abrir a ficha da operação. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.resultado_por_operacao".
4. **O elemento de assinatura:** A cascata do mês com a receita em duas linhas (CT-e e NFS-e).
5. **De onde vem o número:** `nucleo.resultado_por_operacao` (uma função por tela, totais prontos). Mesma competência da Visão geral; receita pela linha_de_receita; custo com corte do dia 10.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.resultado_por_operacao" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** competência gerencial da v1 (docs/cr-regras.md).
8. **Por que a tela não é uma tabela comum:** A cascata e a tabela fecham no mesmo total entregue pelo banco. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/resultados/por-operacao`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
