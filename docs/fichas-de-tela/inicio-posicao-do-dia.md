# Ficha de tela: Início › Posição do dia (popup obrigatório)

Regra anti-genérico (`docs/fichas-de-tela/README.md`). Desenho completo em `docs/posicao-do-dia.md`.

## 1. A pergunta que a tela responde

"Onde estão os meus conjuntos hoje?"

## 2. Quem usa e que decisão toma

O **gestor de frota**, uma vez por dia, no primeiro acesso depois das 5h. Informa a cidade de cada conjunto (ou "sem
sinal") e a situação do dia; confirma ou corrige o alerta de distância improvável. O **líder da operação** só entra
para **liberar** o popup quando algo impede, com motivo registrado.

## 3. A ação principal e as ações de cada estado

- **Principal:** responder cada conjunto e **Concluir** (o botão só liga quando todos têm resposta).
- **Rascunho:** "Salvar rascunho" (no banco). **Alerta de distância:** **Está certo** ou **Corrigir**. **Sem sinal:**
  pede o motivo e vira pendência de posição. **Erro:** mensagem por causa e **Tentar de novo**. **Sem tabela de
  cidades:** "Sem dados ainda: depende da tabela de cidades" (nunca bloqueia o gestor sem saída: o líder libera).
  **Sem permissão:** o popup não existe para quem não é gestor de frota.

## 4. O elemento de assinatura

Uma linha por conjunto com **"Continua em <cidade de ontem>" em um toque**, os **presets "na oficina" e "no pátio da
filial"**, o **alerta de distância pela estrada** ("1.100 km de ontem: improvável em 1 dia") e o contador "5 de 6
preenchidos" que **não deixa fechar**. É a única tela do Eixo que é uma porta diária.

## 5. De onde vem o número

A posição de ontem e o rascunho vêm de `nucleo.posicoes_do_dia()`; a cidade, de `config.cidade` (de
`cidades_brasil` da v1); a distância, de `nucleo.rota_por_par_de_cidades` quando o par existe, ou da reta com fator
de sinuosidade (parâmetro) marcada "estimada em linha reta". O limite de km por dia é parâmetro.

## 6. O vazio honesto

Sem conjuntos na carteira: "Você não tem conjuntos na carteira hoje." e o popup não abre. Sem coordenada de cidade:
não alerta e mostra "Sem dados ainda: depende da tabela de cidades".

## 7. A regra da v1 portada

A v1 guardava a posição diária do veículo (`vehicle_posicoes_diarias`: cidade, UF, latitude, longitude, por
veículo e dia; 5.147 pontos, 165 veículos). O Eixo porta a regra (um ponto por veículo e dia, em nível de cidade) e
melhora: **obrigatória e diária**, com origem (gestor, Sankhya ou v1), correção sem apagar, alerta de distância e
liberação registrada.

## 8. Por que não é uma tabela comum

É uma **porta** (não fecha até responder), tem **respostas de um toque** em vez de campos livres, **valida o
plausível** (distância por estrada) e **gera a fonte principal da rota**. Uma lista de posições só exibiria; esta tela
**cria o dado todos os dias**.

## Rota e estado

Popup obrigatório do Meu dia (passo 2 de 3), sem rota própria. Gestor de frota. **Construída (Fase 1, n1-tela, 13/11/2026)**: `app/(sistema)/inicio/meu-dia/porta-da-posicao.tsx`; cada resposta grava na hora (o rascunho é o banco); a situação do dia vai junto, sem edição na linha (hipótese).

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/tarefas-e-vinculos/5-posicao-do-dia.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro) ao lado
do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**, com o
motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Início (azul de ação `#3355FF`); nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus, âmbar (2), vermelho (3) e cinza (2); vigente
  verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só pela cor; contraste de 4,5:1 nos
  dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); a placa em Barlow Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Onde estão os seus conjuntos hoje?", "Obrigatório para continuar", "N de M preenchidos", "Continua em <cidade>", "Mudou de cidade", "Sem sinal", "Está certo", "Corrigir", "Salvar rascunho", "Falta N conjunto(s)".
- [ ] **Ordem dos elementos:** título e data; stepper do dia; faixa de obrigatoriedade com o contador; a tabela (Conjunto, Ontem, Onde está hoje, Situação); alerta de distância na linha; rodapé (aviso de LGPD, Salvar rascunho, concluir desligado até responder todos).
- [ ] **Estados:** vazio, carregando (esqueleto), erro (mensagem por causa e "Tentar de novo"), sem permissão,
  dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe).
- [ ] **1366 e 1092:** sem rolagem lateral da página.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da mini placa Mercosul em Barlow Semi
Condensed; os ícones são Tabler; os dados são reais; moeda, data e números pelos componentes de
`components/formato/`. Específico desta tela: o popup do protótipo tem 1040 px; no Eixo é o componente `Assistente` em popup obrigatório (porta): o Esc não fecha, a cidade vem de busca na tabela de cidades, e o liberar é só do líder.
