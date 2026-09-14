# Arquitetura

## Visao geral

O Minezera / FP Craft e um jogo voxel estilo Minecraft feito em JavaScript no navegador. O arquivo principal do jogo continua sendo `index.html`, que contem renderizacao Three.js, geracao de mundo, fisica, mobs, inventario, crafting, HUD, combate e loop principal.

As alteracoes atuais centralizam a camada web em Node.js/MySQL. O jogador entra por `/`, cria conta em `/registrar`, ve o personagem em `/painel` e abre o jogo por `/game`. O servidor tambem aceita URLs antigas como `/index.php`, `/login/registrar.php`, `/login/painel.php` e `/game.php` para compatibilidade.

O `server.js` renderiza as paginas de login/cadastro/painel, gerencia sessoes por cookie, acessa MySQL com `mysql2`, valida/cria senhas bcrypt com `bcryptjs` e injeta os dados do personagem em `window.MINEZERA_PLAYER` antes de entregar o HTML do jogo.

## Responsabilidades

| Camada | Onde fica | Responsabilidade |
| --- | --- | --- |
| Servidor web/app | `server.js` | Login, cadastro, painel, sessao, APIs, arquivos estaticos e bootstrap do jogo. |
| Entrada web | `/` ou `/index.php` | Tela de login principal, validacao de senha e redirecionamento para `/game`. |
| Cadastro | `/registrar` ou `/login/registrar.php` | Cria conta e personagem inicial no MySQL. |
| Painel | `/painel` ou `/login/painel.php` | Mostra nivel, EXP, HP, forca, kills, dias e skills do personagem. |
| Bootstrap do jogo | `/game` ou `/game.php` | Exige sessao, le o usuario atual e injeta `window.MINEZERA_PLAYER` no `index.html`. |
| Cliente do jogo | `index.html` | Mundo, camera, renderizacao, fisica, mobs, blocos, inventario, crafting, combate, barras de status, saves e UI. |
| API de personagem | `login/api/personagem.php` | Retorna dados da conta/personagem autenticado em JSON. |
| API de save do personagem | `login/api/salvar_personagem.php` | Salva dias, nivel, EXP, HP, fome, posicao, direcao, inventario, hotbar e kills. |
| API de mundo | `login/api/mundo.php` | Carrega/salva o mundo compartilhado em `storage/world/world.json`. |
| Banco | `database/minezera.sql` | Cria as tabelas `classes`, `contas` e `personagens` do banco `minezera`. |
| Sessoes Node | Memoria do processo | Guarda `contaId`, CSRF e expiracao por cookie `minezera_sid`. Reiniciar o processo derruba logins ativos. |
| Assets locais | `assets/` | Skins do jogador. |
| Resource pack padrao | `resourcepack.zip` | Texturas Minecraft Java usadas como padrao quando o jogo abre via HTTP. |
| Recursos de referencia | `recursos/` | Projeto OurWorlds clonado apenas como referencia/assets. Nao e servido pelo Node por padrao. |
| Save do personagem | MySQL | Tabela `personagens`. |
| Save do mundo | Servidor PHP | Arquivo `storage/world/world.json`. |

## Rotas do servidor

### Fluxo Node.js

| Rota | Uso |
| --- | --- |
| `/` ou `/index.php` | Login principal. |
| `/login` | POST de login. |
| `/registrar` ou `/login/registrar.php` | Cadastro de conta e personagem. |
| `/painel` ou `/login/painel.php` | Painel do personagem logado. |
| `/game` ou `/game.php` | Abre o jogo depois do login. |
| `/logout` ou `/login/logout.php` | Encerra a sessao. |
| `/login/api/personagem.php` | JSON do personagem logado. |
| `/login/api/salvar_personagem.php` | POST JSON com progresso do personagem. |
| `/login/api/mundo.php` | GET/POST JSON do mundo compartilhado. |
| `/multiplayer` | WebSocket autenticado para presenca e posicao dos jogadores online. |
| `/assets/...` | Skins e arquivos visuais publicos. |
| `/docs/...` | Screenshot e docs antigos do projeto. |
| `/documentacao/...` | Arquivos Markdown de documentacao. |
| `/resourcepack.zip` | Pacote de textura padrao carregado automaticamente pelo menu. |
| `/health` | Retorna JSON simples para teste de status. |

## Salvamento

O jogo possui dois salvamentos quando aberto por `/game` ou `/game.php`.

### Personagem

`AccountSync.save()` envia dados para `/login/api/salvar_personagem.php`:

- dias jogados;
- nivel e EXP;
- HP e fome;
- posicao `x/y/z`;
- camera `yaw/pitch`;
- inventario com ate 36 slots;
- hotbar selecionada;
- kills.

O envio ocorre periodicamente a cada 30 segundos, ao ganhar EXP e junto com o save do mundo.

### Mundo

O botao `Salvar` chama `Save.save()`, que envia para `/login/api/mundo.php`:

- seed do mundo;
- tempo/dia/clima;
- chunks modificados;
- tile entities de chunks modificados ou armazenados.

O mundo fica em `storage/world/world.json` e e unico/compartilhado para todos os usuarios logados. O personagem fica separado por conta no MySQL.

O botao `Export JSON` continua existindo para baixar uma copia manual do mundo.

## Multiplayer atual

O servidor Node abre um WebSocket em `/multiplayer`. A conexao usa o mesmo cookie de sessao do login, entao apenas jogador autenticado entra no canal.

Quando um jogador conecta, o servidor:

- identifica conta e personagem pela sessao;
- registra o socket em memoria;
- envia uma mensagem `welcome` com os jogadores ja online;
- avisa os outros clientes com `player_joined`;
- escreve no console: `[multiplayer] NOME conectado (...)`.

Durante o jogo, o cliente envia `state` cerca de 10 vezes por segundo com posicao, rotacao, HP, HP maximo, nivel, modo, skin e estado de morte. O servidor retransmite para os outros jogadores como `player_state`.

Para PvP basico, o cliente atacante envia `pvp_hit` com alvo, dano e knockback. O servidor registra no console e repassa `pvp_damage` para o jogador atingido. O cliente atingido aplica `Player.damage()`, entao o dano respeita a invulnerabilidade curta ja existente e nao afeta jogador em Creative.

Quando a aba fecha ou a conexao cai, o servidor remove o jogador, envia `player_left` e escreve no console: `[multiplayer] NOME desconectou`.

No cliente, `Multiplayer` cria avatares remotos com a skin escolhida no menu, nome acima da cabeca e interpolacao da posicao recebida. Esta etapa sincroniza presenca, visualizacao e PvP basico, mas ainda nao sincroniza mineracao, blocos, inventario, mobs ou drops em tempo real.

## Limites atuais

- O Node salva estado, mas nao valida cada acao de gameplay; o navegador ainda calcula mundo, mobs, dano e inventario.
- O multiplayer atual sincroniza presenca/posicao de jogadores, mas nao e um mundo autoritativo completo.
- O mundo salvo em `storage/world/world.json` e compartilhado, entao dois jogadores salvando ao mesmo tempo podem sobrescrever alteracoes.
- As sessoes ficam em memoria; se precisar manter login apos restart, use uma tabela de sessoes ou Redis.
- O servidor Node nao expoe `recursos/`, `.git`, `package.json`, PHP legado ou outros arquivos internos.
