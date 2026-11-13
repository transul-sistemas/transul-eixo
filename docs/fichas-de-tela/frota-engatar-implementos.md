# Ficha: Frota › o assistente Engatar implementos (popup central)

Escrita em 12/11/2026. **Só desenho.** Fatia S1 de `docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (junto da A1).
Referência de layout: `docs/prototipos/soltas-envio-carteira-e-saude/2-engatar-implementos.html` (quadro 3, `Engatar.dc.html`;
dados fictícios). Hoje existe `engatar-implemento` (um implemento por vez); esta ficha é a evolução. Desatrelar faz o caminho
inverso e **não tem quadro** (ver o fim da ficha). Inventário: `docs/assistentes-e-popups.md` (assistentes 8 e 9).

## 1. A pergunta que a tela responde

"Que conjunto vai ficar se eu engatar estas peças neste cavalo, e está tudo certo para engatar?"

## 2. Quem usa e que decisão toma

- **Gestor de frota**: monta o conjunto da carteira dele, escolhendo as peças soltas do pátio da filial do cavalo.
- **Operacional da filial**: engata no pátio, com a peça que está lá.
- **Diretoria e Administrador**: não engatam em nome de ninguém.
- Decisão: quais peças, em que posição e a partir de quando o conjunto passa a valer.

## 3. A ação principal e as ações de cada estado

Botão principal, o mesmo nome do começo ao fim: **Engatar implementos** (no fim, "Implementos engatados"). Passos: Cavalo,
Implementos, Conferir.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto da lista de peças | nenhuma |
| Vazio (pátio sem peça solta) | "Não há peça solta no pátio da filial Matriz." | **Ver as soltas de outras filiais** |
| Busca sem resultado | "Nenhuma placa com este texto." | **Limpar a busca** |
| Peça impedida (MAN, REF) | Linha apagada: "em manutenção: não pode engatar" | **Abrir a ficha da peça** |
| Conjunto misto de carrocerias | "Carrocerias diferentes não formam conjunto." | **Escolher outra peça** |
| Conjunto que não existe (por exemplo, treminhão) | "Esta combinação não existe na TranSul." | **Escolher outras peças** |
| Eixos faltando | Nome "pendente", nunca presumido | **Corrigir placa** (completa os eixos) |
| Erro ao gravar | "Não foi possível engatar. Nada foi gravado. [causa]" | **Tentar de novo** |
| Sem permissão | "Seu perfil só lê a Frota." | **Pedir aprovação** (tarefa) |

## 4. O elemento de assinatura

O quadro **"Conjunto resultante"**: o nome calculado em letra grande ("Bitrem"), a composição em texto ("cavalo + 2
semirreboques de 2 eixos") e a **conferência** ao vivo com marcas de certo (2 semirreboques de 2 eixos formam um bitrem; nenhum
implemento impedido; todos na mesma filial) e um aviso de informação ("cada peça mantém o seu CR e a sua operação; a situação
do conjunto vem do cavalo"). Ao lado, a lista de peças disponíveis no pátio, com a situação e o CR de cada uma.

## 5. De onde vem o número

- Peças disponíveis: `nucleo.placas_do_patio` e a leitura `implementosLivres` do assistente atual (soltas, não impedidas, na filial do cavalo);
  contagem "Disponíveis no pátio da filial Matriz · 5" vem do banco.
- Nome do conjunto: `nucleo.nome_do_conjunto` e a tabela de nomenclatura (carroceria × configuração), nunca gravado na
  placa. Regra da estrutura (03/11/2026): simples = 1 semirreboque de 1 a 6 eixos; bi = 2 de 2 eixos; bitrezão = 2 de 3 eixos;
  rodotrem = 2 de 2 eixos com dolly de 2 no meio. Só cavalo é mestre; só implemento é servo.
- Gravação: `nucleo.engatar(p_cavalo_id, p_implemento_id, p_posicao, p_em)`, uma chamada por peça, em uma Server Action só (Zod,
  `exigirPermissao()`); **tudo ou nada** com "X de Y" no retorno, chave de envio. A conferência prévia é função de leitura
  (`nucleo.conferir_conjunto`).

## 6. O vazio honesto

"Não há peça solta no pátio da filial. As peças soltas de outras filiais aparecem se você pedir." Convida a **Ver as soltas de
outras filiais**. Nunca "0 disponíveis" sem explicar o filtro.

## 7. A regra da v1 portada

A v1 engatava pelo status do cavalo valendo para a carreta (`docs/propostas/2026-10-02-status-diario.md`). O Eixo melhora com a
conferência **antes** de gravar (a estrutura, não o total de eixos), a lista só de peças que podem engatar e o evento com hora
(o conjunto muda no instante certo, e a grade muda no dia certo).

## 8. Por que a tela não é uma tabela comum

Um formulário "escolha a placa" gravaria sem dizer o que vira. O assistente **calcula o conjunto resultante** antes, recusa o
que não existe e mostra o que cada peça mantém (CR e operação).

---

## Rota e estado

- Rota proposta: popup sobre `/frota/acompanhamento` (aba Soltas) e sobre a ficha do cavalo (`?assistente=engatar-implemento`
  já existe para um implemento).
- Módulo Frota. Quem vê: Gestor de frota e Operacional (cada um no seu escopo).
- Estado no catálogo: `frota.engatar-implemento` **pronto** (um implemento); vários implementos e a aba Soltas são **esqueleto**.

## Estados e rótulos de vigência

A peça engatada passa a "engatada desde dd/mm/aaaa" (vigente, em verde, com rótulo e ícone); ao desatrelar, "desengatada em
dd/mm/aaaa" (encerrado, vermelho suave). Nada é apagado: a composição guarda o início e o fim.

## Atalhos

Ctrl+K "Engatar implemento" (existe). Passos: Enter continua, Esc fecha (pergunta antes de descartar, salva rascunho), Ctrl+Enter
confirma o passo final. O foco volta ao botão "Engatar" da linha.

## Dúvidas e hipóteses

- **Desatrelar não tem quadro.** O quadro só cita o caminho inverso "na ficha do conjunto". Hipótese: o mesmo molde, com a lista
  das peças do conjunto marcadas para sair e o conjunto restante calculado. Falta desenhar.
- (H) Posição na composição é a ordem de escolha; reordenar por arrastar fica fora da primeira versão.
- Dúvida: a lista mostra o CR de cada peça; se a peça tem CR de outra operação, o aviso "mantém o seu CR e a sua operação"
  basta, ou deve oferecer **Trocar CR**? Hipótese: basta o aviso.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/soltas-envio-carteira-e-saude/2-engatar-implementos.html`. Marque cada item ao fim do
bloco, com a captura a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai
para **Pontos para revisar**, com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, azul de ação `#3355FF`; cor do módulo Frota
  `#4338CA`; o quadro "Conjunto resultante" em azul suave com borda de ação; nenhum hexadecimal escrito à mão.
- [ ] **Tons de status:** PÁT em azul, MAN em vermelho suave; marcas de certo em verde e de informação em azul, com ícone e
  texto; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); o nome do conjunto em peso 700 e tamanho de destaque; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** "Engatar implementos", "Disponíveis no pátio da filial <X>", "Conjunto resultante", "Conferência",
  "Buscar placa", "Continuar".
- [ ] **Ordem dos elementos:** título e subtítulo (placa do cavalo, modelo, ano, filial, data); stepper (Cavalo, Implementos,
  Conferir); coluna das peças (busca e lista) e coluna do conjunto resultante; rodapé (Cancelar, Voltar, Continuar) e a nota
  sobre as abas Soltas e Conjuntos.
- [ ] **Estados:** vazio, carregando, erro com "Tentar de novo", sem permissão, dado parcial (nome "pendente").
- [ ] **Tema claro e escuro**, com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; o popup tem 1080 px no protótipo e cabe em 1092 com a margem.

**O que sempre difere por natureza (não é desvio):** a placa é a **mini placa Mercosul** em Barlow Semi Condensed; os ícones
são Tabler; os dados são reais; o popup é o componente `Assistente` em variante de popup central, com rascunho salvo, "fechar é
fechar" e Esc; as marcas de certo e de informação usam ícones Tabler com texto.
