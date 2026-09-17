(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Naturalist 2.0.3 entity resources are compiled model classes rather than
  // portable JSON model files. These definitions keep the authoritative mob
  // catalog shared by Node and the browser while the renderer uses a matching
  // procedural model family and the original Naturalist texture.
  const texture = (path) => `assets/naturalist/textures/entity/${path}`;
  const sound = (folder, ambient = 'idle1', hurt = 'hurt1', death = 'death1') => ({
    ambient: [`assets/sounds/naturalist/mob/${folder}/${ambient}.ogg?v=2.0.3`],
    hurt: [`assets/sounds/naturalist/mob/${folder}/${hurt}.ogg?v=2.0.3`],
    death: [`assets/sounds/naturalist/mob/${folder}/${death}.ogg?v=2.0.3`]
  });
  const rootSound = (name, ambient, hurt = 'hurt1', death = 'death1') => ({
    ambient: [`assets/sounds/naturalist/mob/${name}_${ambient}.ogg?v=2.0.3`],
    hurt: [`assets/sounds/naturalist/mob/${name}_${hurt}.ogg?v=2.0.3`],
    death: [`assets/sounds/naturalist/mob/${name}_${death}.ogg?v=2.0.3`]
  });

  // id, display name, width, height, health, speed, damage, hostile, family, texture path, sounds
  const rows = [
    ['alligator', 'Jacaré', .75, .85, 30, 1.35, 5, true, 'quadruped', 'alligator/alligator.png', sound('alligator', 'idle1', 'hurt1', 'death')],
    ['anglerfish', 'Peixe-pescador', .45, .45, 10, 1.5, 2, true, 'aquatic', 'anglerfish/red.png', sound('anglerfish', 'idle1', 'hurt1', 'death1')],
    ['ant', 'Formiga', .16, .18, 4, 1.8, 0, false, 'insect', 'ant.png', sound('ant')],
    ['bass', 'Achigã', .35, .3, 8, 1.6, 0, false, 'aquatic', 'bass.png', sound('bass')],
    ['bear', 'Urso pardo', .75, 1.35, 30, 1.7, 6, true, 'quadruped', 'bear/bear.png', sound('bear', 'idle1', 'hurt1', 'death1')],
    ['bird', 'Pássaro', .25, .45, 6, 2.5, 0, false, 'bird', 'bird/american_robin.png', sound('bird/generic', 'idle1', 'hurt1', 'death1')],
    ['black_bear', 'Urso preto', .78, 1.4, 35, 1.65, 7, true, 'quadruped', 'black_bear/black_bear.png', sound('black_bear')],
    ['blobfish', 'Peixe-bolha', .42, .3, 8, 1.2, 0, false, 'aquatic', 'blobfish/gray.png', sound('blobfish', 'swim1', 'hurt1', 'death1')],
    ['boar', 'Javali', .55, .75, 16, 1.8, 3, false, 'quadruped', 'boar.png', sound('boar')],
    ['butterfly', 'Borboleta', .22, .18, 4, 2.2, 0, false, 'flying', 'butterfly/blue_morpho.png', sound('butterfly', 'idle1', 'hurt1', 'death1')],
    ['capybara', 'Capivara', .65, .65, 20, 1.35, 0, false, 'quadruped', 'capybara/capybara.png', sound('capybara')],
    ['caterpillar', 'Lagarta', .22, .16, 4, .65, 0, false, 'insect', 'caterpillar.png', sound('caterpillar')],
    ['catfish', 'Bagre', .4, .3, 8, 1.4, 0, false, 'aquatic', 'catfish.png', sound('catfish', 'swim1', 'hurt1', 'death1')],
    ['clam', 'Ostra', .35, .22, 6, 0.4, 0, false, 'aquatic', 'clam/white_clam.png', sound('clam')],
    ['crab', 'Caranguejo', .4, .25, 8, 1.1, 1, false, 'insect', 'crab/red_crab.png', sound('crab')],
    ['deer', 'Veado', .55, 1.35, 16, 2.25, 0, false, 'quadruped', 'deer/deer.png', sound('deer', 'ambient', 'hurt', 'death')],
    ['desert_scorpion', 'Escorpião do deserto', .35, .25, 12, 1.6, 4, true, 'insect', 'scorpion/desert_scorpion.png', sound('scorpion')],
    ['dragonfly', 'Libélula', .25, .18, 4, 2.6, 0, false, 'flying', 'dragonfly/blue_dragonfly.png', sound('dragonfly')],
    ['duck', 'Pato', .3, .55, 6, 1.65, 0, false, 'bird', 'duck/duck.png', sound('duck')],
    ['elephant', 'Elefante', 1.0, 2.6, 60, 1.1, 8, false, 'quadruped', 'elephant/elephant.png', sound('elephant', 'ambient', 'hurt', 'death')],
    ['firefly', 'Vagalume', .16, .2, 4, 1.4, 0, false, 'flying', 'firefly.png', sound('firefly', 'idle1', 'hurt1', 'death1')],
    ['giant_isopod', 'Isópode gigante', .5, .28, 12, .8, 1, false, 'aquatic', 'giant_isopod/blue.png', sound('giant_isopod')],
    ['giraffe', 'Girafa', .7, 2.8, 30, 1.6, 4, false, 'quadruped', 'giraffe/giraffe.png', rootSound('giraffe', 'idle')],
    ['great_white_shark', 'Tubarão-branco', 1.0, .8, 40, 2.4, 8, true, 'aquatic', 'great_white_shark.png', sound('great_white_shark')],
    ['hedgehog', 'Ouriço', .3, .32, 8, 1.2, 1, false, 'quadruped', 'hedgehog/brown.png', sound('hedgehog')],
    ['hippo', 'Hipopótamo', .9, 1.25, 40, 1.25, 7, true, 'quadruped', 'hippo/hippo.png', sound('hippo', 'ambient', 'hurt', 'death')],
    ['jellyfish', 'Água-viva', .35, .55, 8, 1.1, 3, true, 'aquatic', 'jellyfish/blue.png', sound('jellyfish')],
    ['jungle_scorpion', 'Escorpião da selva', .35, .25, 14, 1.7, 5, true, 'insect', 'scorpion/green_jungle_scorpion.png', sound('scorpion')],
    ['komodo_dragon', 'Dragão-de-komodo', .65, .65, 24, 1.5, 5, true, 'quadruped', 'komodo_dragon.png', sound('komodo_dragon')],
    ['lion', 'Leão', .7, 1.15, 26, 2.15, 6, true, 'quadruped', 'lion/lion.png', sound('lion', 'ambient', 'hurt', 'death')],
    ['lizard', 'Lagarto', .35, .3, 8, 1.3, 0, false, 'quadruped', 'lizard/beardie.png', sound('lizard')],
    ['mammoth', 'Mamute', 1.0, 2.55, 70, .9, 9, false, 'quadruped', 'mammoth/mammoth.png', sound('mammoth')],
    ['mole', 'Toupeira', .3, .28, 8, 1.15, 0, false, 'quadruped', 'mole.png', sound('mole')],
    ['ostrich', 'Avestruz', .45, 1.55, 14, 2.3, 2, false, 'bird', 'ostrich/ostrich.png', sound('ostrich')],
    ['piranha', 'Piranha', .3, .22, 6, 1.9, 3, true, 'aquatic', 'piranha.png', sound('piranha')],
    ['rat', 'Rato', .22, .24, 6, 1.8, 0, false, 'quadruped', 'rat/brown.png', sound('rat')],
    ['ray', 'Arraia', .8, .22, 12, 1.7, 1, false, 'aquatic', 'ray/stingray.png', sound('ray')],
    ['rhino', 'Rinoceronte', .9, 1.65, 50, 1.5, 9, false, 'quadruped', 'rhino.png', sound('rhino', 'ambient', 'hurt', 'death')],
    ['snail', 'Caracol', .25, .2, 4, .35, 0, false, 'insect', 'snail/brown.png', sound('snail', 'move', 'hurt', 'death')],
    ['snake', 'Cobra', .25, .22, 8, 1.55, 3, true, 'snake', 'snake/green_snake.png', sound('snake', 'hiss', 'hurt', 'death')],
    ['starfish', 'Estrela-do-mar', .3, .12, 4, .2, 0, false, 'aquatic', 'starfish/red.png', sound('starfish')],
    ['tiger', 'Tigre', .7, 1.1, 26, 2.1, 7, true, 'quadruped', 'tiger/tiger.png', sound('tiger')],
    ['tortoise', 'Tartaruga terrestre', .55, .35, 20, .45, 0, false, 'quadruped', 'tortoise/green.png', sound('tortoise')],
    ['turkey', 'Peru', .4, .75, 8, 1.45, 0, false, 'bird', 'turkey.png', sound('turkey')],
    ['vulture', 'Abutre', .45, .8, 12, 1.8, 1, false, 'bird', 'vulture.png', sound('vulture', 'ambient', 'hurt', 'death')],
    ['whale', 'Baleia', 1.35, 1.1, 60, 1.8, 0, false, 'aquatic', 'whale/whale.png', sound('whale')],
    ['zebra', 'Zebra', .6, 1.35, 20, 2.2, 0, false, 'quadruped', 'zebra.png', sound('zebra', 'ambient', 'hurt', 'death')]
  ];

  const defs = Object.fromEntries(rows.map(([id, name, w, h, health, speed, damage, hostile, family, image, sounds]) => [id, {
    id, name, w, h, health, speed, damage, hostile, passive: !hostile, family, image, texture: texture(image), sounds,
    drops: [], element: null, elementDamage: 0, elementDuration: 0
  }]));
  return { NATURALIST_MOBS: Object.freeze(defs), NATURALIST_MOB_IDS: Object.freeze(rows.map(row => row[0])), NATURALIST_SOUND_SPECS: Object.freeze(Object.fromEntries(rows.map(row => [row[0], row[10]]))) };
});

// Browser-only bridge: the main game remains a single inline script, so add
// the shared definitions after it has declared its registries. This also lets
// the default resource pack discover Naturalist textures by their original
// namespace without changing the vanilla loader's matching rules.
if (typeof window !== 'undefined' && typeof NATURALIST_MOBS !== 'undefined') {
  if (typeof MOB_TYPES !== 'undefined') Object.assign(MOB_TYPES, NATURALIST_MOBS);
  if (typeof ENTITY_TEXTURE_PATHS !== 'undefined') {
    for (const mob of Object.values(NATURALIST_MOBS)) ENTITY_TEXTURE_PATHS[mob.id] = [mob.texture];
  }
  if (window.MinezeraSound?.samples) {
    for (const [id, events] of Object.entries(NATURALIST_SOUND_SPECS || {})) {
      for (const [event, urls] of Object.entries(events || {})) window.MinezeraSound.samples[`mob_${id}_${event}`] = urls;
    }
  }
}
