# Estrutura do projeto

## Pastas e arquivos

| Caminho | Funcao |
| --- | --- |
| `server.js` | Servidor Node principal: login, cadastro, painel, APIs, sessao e arquivos publicos. |
| `index.php` | Entrada PHP antiga mantida no repositorio; no Node, `/index.php` e rota de compatibilidade. |
| `game.php` | Bootstrap PHP antigo; no Node, `/game.php` e rota de compatibilidade para `/game`. |
| `index.html` | Jogo completo em um unico arquivo: HTML, CSS e JavaScript. |
| `.htaccess` | Configuracao antiga para Apache/PHP. Nao e usada pelo servidor Node. |
| `package.json` | Scripts de execucao e requisito de Node. |
| `database/minezera.sql` | Estrutura MySQL do banco `minezera`. |
| `login/` | Telas/APIs PHP antigas e CSS reaproveitado pelo Node. |
| `storage/sessions/` | Sessoes PHP antigas. O Node usa sessao em memoria. |
| `storage/world/` | Save do mundo em JSON, criado pela API quando necessario. |
| `resourcepack.zip` | Pacote de textura padrao carregado automaticamente via HTTP. |
| `assets/` | Skins do jogador usadas no seletor da tela inicial. |
| `docs/` | Screenshot/documentacao original do repositorio. |
| `documentacao/` | Documentacao atual em Portugues para manutencao e deploy. |
| `recursos/` | Repositorio OurWorlds clonado para consulta e reaproveitamento de assets/ideias. |
| `.gitignore` | Ignora resource packs, zips, logs e dependencias locais. |

## Fluxo web

1. Usuario acessa `/`.
2. Se nao tiver conta, cria em `/registrar`.
3. Node salva senha bcrypt e cria personagem inicial no MySQL.
4. Login valido grava uma sessao em memoria e envia cookie `minezera_sid`.
5. `/game` le conta/personagem e injeta `window.MINEZERA_PLAYER`.
6. `index.html` usa esses dados para iniciar nivel, EXP, HP, fome, posicao, inventario, hotbar, kills e dias jogados.
7. Durante o jogo, `AccountSync` salva personagem em `login/api/salvar_personagem.php`.
8. O save do mapa vai para `login/api/mundo.php` e fica em `storage/world/world.json`.

## Secoes principais do `index.html`

O codigo e organizado por banners numerados:

| Secao | Sistema |
| --- | --- |
| 1 | Utilitarios, constantes, PRNG e noise. |
| 2 | Registro de blocos e itens. |
| 3 | Receitas, smelting e combustiveis. |
| 4 | Texturas procedurais. |
| 5 | Atlas de texturas e loader de resource packs. |
| 6 | Armazenamento do mundo, chunks e tile entities. |
| 7 | Geracao de terreno. |
| 8 | Iluminacao. |
| 9 | Meshing/render de blocos. |
| 10 | Chunk manager. |
| 11 | Fisica, input e jogador. |
| 12 | Interacoes: minerar, atacar, colocar e usar. |
| 13 | Inventario, crafting table, furnace, chest e creative. |
| 14 | Entidades: drops, flechas, TNT, particulas e explosoes. |
| 15 | Mobs: modelos, IA, spawn, combate e drops. |
| 16 | Simulacao: fluidos, fogo, random ticks e redstone. |
| 17 | Ceu e clima. |
| 18 | HUD, persistencia e menus. |
| 19 | Bootstrap e loop principal. |

## Mundo de teste

O mundo padrao de teste usa:

- tamanho alvo: `1000 x 1000`;
- limite logico: `TEST_WORLD_HALF = 500`;
- seed aleatoria com prefixo `fp-craft-mountains-lakes-caves-`;
- terreno com montanhas, lagos, cavernas, ravinas, biomas e estruturas.

## Resource packs

O loader aceita `.zip` de resource pack Java e procura texturas em:

- `assets/minecraft/textures/block/`;
- `assets/minecraft/textures/blocks/`;
- `assets/minecraft/textures/item/`;
- `assets/minecraft/textures/items/`;
- caminhos de entidades especificos para porco, vaca, ovelha, galinha, zumbi, esqueleto e creeper.

Arquivos ausentes caem para as texturas procedurais do jogo.
