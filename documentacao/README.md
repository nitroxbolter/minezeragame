# Documentacao do Minezera / FP Craft

Esta pasta descreve como o Minezera / FP Craft esta organizado, como a pagina web conecta login, jogo e banco de dados, como rodar em servidor Linux e quais sistemas de gameplay ja existem no codigo atual.

## Arquivos

- `ARQUITETURA.md`: como o jogo roda hoje, o que fica no navegador e o que fica no servidor Node/MySQL.
- `ESTRUTURA.md`: mapa dos arquivos e das secoes principais do `index.html`.
- `JOGABILIDADE.md`: vida do jogador, barras de HP/fome/EXP, modos, mobs, drops, spawn, itens e progressao.
- `SERVIDOR-LINUX.md`: passo a passo para rodar em Ubuntu 22.04 com Node.js e MySQL.

## Estado atual

O jogo ja roda em navegador e agora o caminho recomendado e o servidor Node.js:

- `server.js` faz login, cadastro, painel, sessao por cookie, APIs de personagem e mundo;
- MySQL salva contas e personagens usando o SQL em `database/minezera.sql`;
- `game.php` continua aceito como URL de compatibilidade, mas quem responde agora pode ser o Node;
- as APIs antigas em `login/api/...` continuam funcionando para o `index.html`.

O jogo ainda calcula fisica, mobs, inventario e combate no navegador. O servidor Node salva estado, autentica usuarios e sincroniza presenca/posicao dos jogadores por WebSocket, mas ainda nao e autoritativo para multiplayer completo em tempo real. Para varios jogadores interagindo no mesmo mundo de forma consistente, sera necessario adicionar salas, validacao de acoes e sincronizacao de blocos, mobs, dano e drops.
