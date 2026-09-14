# Jogabilidade e dados atuais

## Jogador

| Atributo | Valor |
| --- | --- |
| Vida maxima | 20 pontos no nivel 1, mais 2 pontos por nivel. |
| Vida inicial | 20. |
| Fome maxima | 20 pontos. |
| Fome inicial | 20. |
| Saturacao inicial | 5. |
| Ar inicial | 300 ticks. |
| Regeneracao | Com fome >= 18, recupera 1 ponto de vida a cada 80 ticks e consome exaustao. |
| Fome zerada | Causa 1 de dano a cada 80 ticks, mas nao mata abaixo de 1 ponto. |
| Modos | Survival e Creative. |
| Nivel/XP | Existe nivel e EXP. Mobs passivos dao 2 EXP; hostis dao 5 EXP. |

## Barras de status do jogador

O HUD desenha as barras no canvas `#bars`.

| Barra | Quando aparece | Como funciona |
| --- | --- | --- |
| HP | Survival | Mostra vida atual sobre vida maxima. A cor fica mais clara quando o jogador toma dano. |
| Fome | Survival | Mostra fome atual sobre 20. Sprint depende de fome acima de 6. |
| Nivel/EXP | Survival | Mostra `Nv X EXP` com progresso ate o proximo nivel. |
| Ar | Quando a cabeca esta na agua ou o ar baixou | Mostra bolhas calculadas a partir de `player.air`. |

No creative, as barras principais nao sao desenhadas porque `HUD.drawBars()` retorna cedo.

## Nivel, EXP e HP maximo

- Nivel inicial: 1.
- HP maximo no nivel 1: 20.
- Cada nivel aumenta o HP maximo em 2.
- EXP necessaria para o proximo nivel:
  - ate o nivel 15: `2 * nivel + 7`;
  - do nivel 16 ao 30: `5 * nivel - 38`;
  - acima do nivel 30: `9 * nivel - 158`.
- Ao subir de nivel, o jogador recebe tambem 2 pontos de cura, limitado ao novo HP maximo.
- O progresso e salvo no MySQL por `login/api/salvar_personagem.php`.

## Mobs

Existem 7 mobs implementados.

| Mob | Tipo | Vida | Velocidade | Ataque/comportamento | Drops |
| --- | --- | ---: | ---: | --- | --- |
| Pig | Passivo | 10 | 1.6 | Anda pelo mundo e foge ao tomar dano. | `porkchop` 1-3 |
| Cow | Passivo | 10 | 1.5 | Anda pelo mundo e foge ao tomar dano. | `beef` 1-3, `leather` 0-2 |
| Sheep | Passivo | 8 | 1.5 | Anda pelo mundo, pode ser tosquiada e regenera la depois. | `mutton` 1-2, mais 1 la colorida se morrer sem estar tosquiada |
| Chicken | Passivo | 4 | 1.7 | Anda pelo mundo e foge ao tomar dano. | `chicken` 1, `feather` 0-2 |
| Zombie | Hostil | 20 | 2.4 | Persegue e causa 3 de dano corpo a corpo. Queima de dia. | `rotten_flesh` 0-2 |
| Skeleton | Hostil | 20 | 2.6 | Mantem distancia e atira flechas. Queima de dia. | `bone` 0-2, `arrow` 0-2 |
| Creeper | Hostil | 20 | 2.6 | Persegue e explode perto do jogador. | `gunpowder` 0-2 |

## Barras de HP dos monstros

Cada mob recebe um sprite de barra de vida no modelo 3D. Essa barra fica escondida por padrao e aparece por alguns segundos quando o mob toma dano. Ela mostra:

- texto `vida_atual / vida_maxima`;
- fundo escuro;
- preenchimento vermelho proporcional ao HP;
- posicionamento acima da cabeca do mob.

Quando o mob morre, a barra e ocultada. Ao matar um mob, o jogador ganha kill e EXP: 2 para passivos e 5 para hostis.

## Spawn de mobs passivos

- Limite aproximado: ate 14 mobs passivos vivos.
- Tenta spawnar a cada 4 ticks de simulacao.
- Ocorre em chunks ja meshed que ainda nao receberam populacao passiva.
- Chance por chunk novo: 30%.
- Precisa nascer sobre `grass_block`.
- Grupo: 2 a 4 mobs.
- Lista ponderada: `pig`, `cow`, `sheep`, `chicken`, `sheep`, `cow`.
- Todos precisam passar em `canStand`, ou seja: espaco livre, sem liquido e bloco solido embaixo.

## Spawn de mobs hostis

- Limite aproximado: ate 26 hostis vivos por spawn natural.
- Tenta spawnar a cada 2 ticks de simulacao.
- Escolhe posicao aleatoria em um raio de ate 48 blocos do jogador.
- Distancia valida do jogador: maior que 24 e menor que 70 blocos.
- Pode nascer na superficie ou em cavernas.
- Luz precisa ser menor que 8.
- Nao nasce sobre liquidos.
- Grupo: 1 a 3 mobs.
- Lista ponderada: `zombie`, `zombie`, `skeleton`, `creeper`.

## Spawners de dungeon

- Dungeons podem gerar spawners de `zombie` ou `skeleton`.
- Peso atual: zumbi aparece duas vezes na lista, entao e mais comum.
- O spawner ativa se o jogador estiver em ate 16 blocos.
- Cooldown apos ativar: 200 a 799 ticks.
- Tenta ate 4 posicoes em volta do spawner.
- Para se ja houver mais de 30 hostis.

## Itens e drops importantes

### Drops de mobs

| Fonte | Drops |
| --- | --- |
| Pig | `porkchop` 1-3 |
| Cow | `beef` 1-3, `leather` 0-2 |
| Sheep | `mutton` 1-2, la colorida se nao estiver tosquiada |
| Sheep com shears | la colorida 1-3 sem matar o mob |
| Chicken | `chicken` 1, `feather` 0-2 |
| Zombie | `rotten_flesh` 0-2 |
| Skeleton | `bone` 0-2, `arrow` 0-2 |
| Creeper | `gunpowder` 0-2 |

### Categorias de itens

- Blocos colocaveis: todo bloco sem `noItem` vira item automaticamente.
- Materiais: `stick`, `coal`, `charcoal`, `iron_ingot`, `gold_ingot`, `diamond`, `emerald`, `redstone`, `lapis_lazuli`, `glowstone_dust`, `gunpowder`, `flint`, `string`, `feather`, `leather`, `bone`, `book`, `snowball`, `wheat`, `wheat_seeds`, `egg`, `paper`, `sugar`.
- Comidas: `apple`, `bread`, `porkchop`, `cooked_porkchop`, `beef`, `cooked_beef`, `chicken`, `cooked_chicken`, `mutton`, `cooked_mutton`, `rotten_flesh`, `carrot`, `melon_slice`.
- Ferramentas por material: pickaxe, axe, shovel, hoe e sword em madeira, pedra, ferro, ouro e diamante.
- Ferramentas especiais: `shears`, `flint_and_steel`, `bucket`, `water_bucket`, `lava_bucket`, `bow`, `arrow`.

## Combate

- Ataque corpo a corpo usa o dano do item segurado, ou 1 sem arma.
- Espadas causam de 4 a 7 conforme material.
- Machados causam de 7 a 9 conforme material.
- Arco consome flecha e dispara `arrow` com dano do jogador.
- Esqueletos disparam flechas com dano entre 2 e 4.
- Creeper explode com poder 3; TNT explode com poder 4.
- PvP basico funciona contra jogadores remotos em Survival: clique esquerdo envia o hit pelo WebSocket, o alvo recebe dano e knockback.
- Jogadores em Creative nao recebem dano porque `Player.damage()` ignora dano nesse modo.

## Sistemas ainda ausentes

- Nao ha encantamento.
- Nao ha aldeoes/trading.
- Nao ha Nether/End.
- Ha presenca multiplayer por WebSocket, skins remotas e PvP basico, mas ainda nao ha sincronizacao completa de blocos, mobs, drops e inventario em tempo real.
- Nao ha servidor autoritativo validando combate, mobs e inventario em tempo real.
