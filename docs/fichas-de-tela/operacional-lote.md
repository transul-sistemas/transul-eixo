# Ficha: Operacional › Pátio e Ordens (ações em lote)

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Como avançar várias placas de uma vez sem perder quem foi recusado?
2. **Quem usa e que decisão toma:** Operacional da filial.
3. **A ação principal e as ações de cada estado:** **Aceitar placas**, **Concluir carregamentos**, **Liberar viagens** (popup; a seleção vale para a página). Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.avancar_no_patio".
4. **O elemento de assinatura:** O resultado "X de Y" com o motivo de cada recusa; cada placa é um pedido independente.
5. **De onde vem o número:** `nucleo.avancar_no_patio` (uma função por tela, totais prontos). nucleo.avancar_no_patio, uma chamada por placa com a parte da chave de envio.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.avancar_no_patio" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Lote que não derruba o resto e diz o que faltou. KPIs da fila também no Totem. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/operacional/patio e /operacional/ordens-de-carregamento`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
