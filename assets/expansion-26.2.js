/* Minezera 26.2 gameplay expansion. Loaded after the core engine and before Game.init(). */
(() => {
  'use strict';

  const copyStack = (s, count = s && s.count) => s ? {
    name: s.name, count, dur: s.dur,
    ench: s.ench ? { ...s.ench } : undefined,
    trim: s.trim ? { ...s.trim } : undefined
  } : null;
  const heldItem = () => { const s = Player.held(); return s ? Items.get(s.name) : null; };
  const consumeNamed = (name, count = 1) => Player.isCreative() || Inventory.removeItem(player.inventory, name, count);
  const give = (name, count = 1, extra = {}) => {
    const stack = Object.assign({ name, count }, extra);
    const left = Inventory.addToPlayer(stack);
    if (left) Entities.spawnItem(player.x, player.y + 1, player.z, Object.assign({}, stack, { count: left }));
    return left === 0;
  };
  const ensureItem = (name, options = {}) => {
    let it = Items.get(name);
    if (!it) return Items.define(name, options);
    Object.assign(it, options);
    if (it.type !== 'block') Blocks.textureNames.add(it.tex || name);
    return it;
  };
  const defineBlock = (name, options) => {
    let block = Blocks.byName[name];
    if (!block) block = Blocks.define(name, options);
    B[name] = block.id;
    ensureItem(name, { type: 'block', block: block.id, tex: block.itemTex || name, displayName: block.displayName, creativeTab: 'blocks' });
    return block;
  };

  /* Blocks and machines */
  defineBlock('enchanting_table', { tex: { top: 'enchanting_table_top', bottom: 'enchanting_table_bottom', side: 'enchanting_table_side' }, model: 'box', box: [0, 0, 0, 16, 12, 16], hardness: 5, tool: 'pickaxe', tier: 1, requiresTool: true, interactive: 'enchanting', transparent: true, opaque: false });
  defineBlock('brewing_stand', { tex: { top: 'brewing_stand', bottom: 'brewing_stand_base', side: 'brewing_stand' }, model: 'box', box: [3, 0, 3, 13, 14, 13], hardness: 0.5, tool: 'pickaxe', interactive: 'brewing', tileEntity: true, transparent: true, opaque: false, icon: 'flat', itemTex: 'brewing_stand' });
  defineBlock('stonecutter', { tex: { top: 'stonecutter_top', bottom: 'stonecutter_bottom', side: 'stonecutter_side' }, model: 'box', box: [0, 0, 0, 16, 9, 16], hardness: 3.5, tool: 'pickaxe', tier: 1, requiresTool: true, interactive: 'stonecutter', transparent: true, opaque: false, extraTex: ['stonecutter_saw'] });
  defineBlock('blast_furnace', { tex: { top: 'blast_furnace_top', bottom: 'blast_furnace_top', side: 'blast_furnace_side', front: 'blast_furnace_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1, requiresTool: true, interactive: 'blast_furnace', tileEntity: true, facing: true, extraTex: ['blast_furnace_front_on'] });
  defineBlock('hopper', { tex: { top: 'hopper_top', bottom: 'hopper_outside', side: 'hopper_outside' }, hardness: 3, tool: 'pickaxe', tier: 1, requiresTool: true, interactive: 'hopper', tileEntity: true, extraTex: ['hopper_inside'] });
  defineBlock('observer', { tex: { top: 'observer_top', bottom: 'observer_top', side: 'observer_side', front: 'observer_front', nz: 'observer_back' }, hardness: 3, tool: 'pickaxe', tier: 1, requiresTool: true, facing: true, extraTex: ['observer_back_on'] });
  defineBlock('dispenser', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'dispenser_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1, requiresTool: true, interactive: 'dispenser', tileEntity: true, facing: true, extraTex: ['dispenser_front_vertical'] });
  defineBlock('piston', { tex: { top: 'piston_top', bottom: 'piston_bottom', side: 'piston_side', front: 'piston_top' }, hardness: 1.5, tool: 'pickaxe', facing: true, extraTex: ['piston_inner'] });
  defineBlock('sticky_piston', { tex: { top: 'piston_top_sticky', bottom: 'piston_bottom', side: 'piston_side', front: 'piston_top_sticky' }, hardness: 1.5, tool: 'pickaxe', facing: true, extraTex: ['piston_inner'] });
  defineBlock('repeater', { model: 'layer', box: [0, 0, 0, 16, 2, 16], tex: 'repeater', variants: (m) => (m & 4) ? 'repeater_on' : 'repeater', hardness: 0, solid: false, transparent: true, opaque: false, needsSupport: 'below', facing: true, icon: 'flat' });
  defineBlock('comparator', { model: 'layer', box: [0, 0, 0, 16, 2, 16], tex: 'comparator', variants: (m) => (m & 4) ? 'comparator_on' : 'comparator', hardness: 0, solid: false, transparent: true, opaque: false, needsSupport: 'below', facing: true, icon: 'flat' });
  for (const [name, tex, onTex] of [
    ['rail', 'rail', null], ['powered_rail', 'powered_rail', 'powered_rail_on'],
    ['detector_rail', 'detector_rail', 'detector_rail_on'], ['activator_rail', 'activator_rail', 'activator_rail_on']
  ]) defineBlock(name, { model: 'layer', box: [0, 0, 0, 16, 1, 16], tex, variants: onTex ? (m) => (m & 4) ? onTex : tex : null, hardness: 0.7, tool: 'pickaxe', solid: false, transparent: true, opaque: false, needsSupport: 'below', icon: 'flat' });
  defineBlock('bee_nest', { tex: { top: 'bee_nest_top', bottom: 'bee_nest_bottom', side: 'bee_nest_side', front: 'bee_nest_front' }, hardness: 0.3, tool: 'axe', interactive: 'hive', tileEntity: true, facing: true, flammable: 30, extraTex: ['bee_nest_front_honey'] });
  defineBlock('beehive', { tex: { top: 'beehive_end', bottom: 'beehive_end', side: 'beehive_side', front: 'beehive_front' }, hardness: 0.6, tool: 'axe', interactive: 'hive', tileEntity: true, facing: true, flammable: 30, extraTex: ['beehive_front_honey'] });
  defineBlock('smithing_table', { tex: { top: 'smithing_table_top', bottom: 'oak_planks', side: 'smithing_table_side', front: 'smithing_table_front' }, hardness: 2.5, tool: 'axe', interactive: 'smithing', facing: true });
  Blocks.byName.brewing_stand.onPlace = (x, y, z) => world.setTile(x, y, z, Brewing.create());
  Blocks.byName.blast_furnace.onPlace = (x, y, z) => world.setTile(x, y, z, BlastFurnace.create());
  Blocks.byName.hopper.onPlace = (x, y, z) => world.setTile(x, y, z, { type: 'hopper', slots: new Array(5).fill(null) });
  Blocks.byName.dispenser.onPlace = (x, y, z) => world.setTile(x, y, z, { type: 'dispenser', slots: new Array(9).fill(null) });
  Blocks.byName.bee_nest.onPlace = Blocks.byName.beehive.onPlace = (x, y, z) => world.setTile(x, y, z, { type: 'hive', honey: 0 });

  /* Items */
  ensureItem('fishing_rod', { type: 'tool', stack: 1, tex: 'fishing_rod', tool: { kind: 'fishing_rod', tier: 'wooden', level: 0, speed: 1, durability: 64 }, creativeTab: 'tools' });
  ensureItem('cod', { type: 'food', tex: 'cod', food: { hunger: 2, saturation: 0.4 }, creativeTab: 'food' });
  ensureItem('salmon', { type: 'food', tex: 'salmon', food: { hunger: 2, saturation: 0.4 }, creativeTab: 'food' });
  ensureItem('glass_bottle', { type: 'material', tex: 'glass_bottle', creativeTab: 'materials' });
  ensureItem('water_bottle', { type: 'material', stack: 1, tex: 'potion', displayName: 'Water Bottle', creativeTab: 'food' });
  ensureItem('blaze_powder', { type: 'material', tex: 'blaze_powder', creativeTab: 'materials' });
  ensureItem('quartz', { type: 'material', tex: 'quartz', creativeTab: 'materials' });
  ensureItem('slime_ball', { type: 'material', tex: 'slime_ball', creativeTab: 'materials' });
  ensureItem('ghast_tear', { type: 'material', tex: 'ghast_tear', creativeTab: 'materials' });
  ensureItem('magma_cream', { type: 'material', tex: 'magma_cream', creativeTab: 'materials' });
  ensureItem('spider_eye', { type: 'food', tex: 'spider_eye', food: { hunger: 2, saturation: 0.8 }, creativeTab: 'food' });
  ensureItem('honey_bottle', { type: 'material', stack: 16, tex: 'honey_bottle', food: null, creativeTab: 'food' });
  ensureItem('elytra', { type: 'tool', stack: 1, tex: 'elytra', displayName: 'Elytra', creativeTab: 'tools' });
  ensureItem('saddle', { type: 'tool', stack: 1, tex: 'saddle', creativeTab: 'tools' });
  ensureItem('oak_boat', { type: 'tool', stack: 1, tex: 'oak_boat', displayName: 'Oak Boat', creativeTab: 'tools' });
  ensureItem('compass', { type: 'tool', stack: 1, tex: 'compass_00', creativeTab: 'tools' });
  ensureItem('coast_armor_trim_smithing_template', { type: 'material', stack: 64, tex: 'coast_armor_trim_smithing_template', displayName: 'Coast Armor Trim', creativeTab: 'materials' });
  for (const armor of ['iron_chestplate', 'diamond_chestplate', 'netherite_chestplate']) ensureItem(armor, { type: 'tool', stack: 1, tex: armor, creativeTab: 'tools' });
  for (const [name, title] of [['potion_swiftness', 'Potion of Swiftness'], ['potion_strength', 'Potion of Strength'], ['potion_regeneration', 'Potion of Regeneration'], ['potion_fire_resistance', 'Potion of Fire Resistance'], ['potion_poison', 'Potion of Poison']]) ensureItem(name, { type: 'material', stack: 1, tex: 'potion', displayName: title, creativeTab: 'food' });

  /* Recipes */
  Recipes.addShaped('fishing_rod', 1, ['  S', ' ST', 'S T'], { S: 'stick', T: 'string' });
  Recipes.addShaped('enchanting_table', 1, [' B ', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' });
  Recipes.addShaped('brewing_stand', 1, [' B ', 'CCC'], { B: 'blaze_powder', C: 'cobblestone' });
  Recipes.addShaped('stonecutter', 1, [' I ', 'SSS'], { I: 'iron_ingot', S: 'stone' });
  Recipes.addShaped('blast_furnace', 1, ['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'stone' });
  Recipes.addShaped('hopper', 1, ['I I', 'ICI', ' I '], { I: 'iron_ingot', C: 'chest' });
  Recipes.addShaped('observer', 1, ['CCC', 'RRQ', 'CCC'], { C: 'cobblestone', R: 'redstone', Q: 'quartz' });
  Recipes.addShaped('dispenser', 1, ['CCC', 'CBC', 'CRC'], { C: 'cobblestone', B: 'bow', R: 'redstone' });
  Recipes.addShaped('piston', 1, ['PPP', 'CIC', 'CRC'], { P: 'tag:planks', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' });
  Recipes.addShapeless('sticky_piston', 1, ['piston', 'slime_ball']);
  Recipes.addShaped('repeater', 1, ['TRT', 'SSS'], { T: 'redstone_torch', R: 'redstone', S: 'stone' });
  Recipes.addShaped('comparator', 1, [' T ', 'TQT', 'SSS'], { T: 'redstone_torch', Q: 'quartz', S: 'stone' });
  Recipes.addShaped('rail', 16, ['I I', 'ISI', 'I I'], { I: 'iron_ingot', S: 'stick' });
  Recipes.addShaped('powered_rail', 6, ['G G', 'GSG', 'GRG'], { G: 'gold_ingot', S: 'stick', R: 'redstone' });
  Recipes.addShaped('beehive', 1, ['PPP', 'HHH', 'PPP'], { P: 'tag:planks', H: 'honey_bottle' });
  Recipes.addShaped('smithing_table', 1, ['II', 'PP', 'PP'], { I: 'iron_ingot', P: 'tag:planks' });
  Recipes.addShaped('oak_boat', 1, ['P P', 'PPP'], { P: 'oak_planks' });
  Recipes.addShaped('compass', 1, [' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'redstone' });
  Recipes.addShaped('glass_bottle', 3, ['G G', ' G '], { G: 'glass' });

  /* Procedural audio fallback; the 26.2 pack contains textures/models but no sounds folder. */
  const soundPaths = (base, names) => names.map(name => `assets/sounds/minecraft/${base}/${name}.ogg?v=26.2`);
  const SoundFX = {
    ctx: null, volume: 0.62, synthVolume: 0.22, last: {}, buffers: new Map(),
    samples: {
      pickup: soundPaths('random', ['pop']), bow: soundPaths('random', ['bow']), explosion: soundPaths('random', ['explode1', 'explode2', 'explode3', 'explode4']), hurt: soundPaths('random', ['classic_hurt']),
      break_stone: soundPaths('dig', ['stone1', 'stone2', 'stone3', 'stone4']), break_grass: soundPaths('dig', ['grass1', 'grass2', 'grass3', 'grass4']), break_wood: soundPaths('dig', ['wood1', 'wood2', 'wood3', 'wood4']),
      place_stone: soundPaths('step', ['stone1', 'stone2', 'stone3', 'stone4']), place_grass: soundPaths('step', ['grass1', 'grass2', 'grass3', 'grass4']), place_wood: soundPaths('step', ['wood1', 'wood2', 'wood3', 'wood4']),
      mob_zombie_ambient: soundPaths('mob/zombie', ['say1', 'say2', 'say3']), mob_zombie_hurt: soundPaths('mob/zombie', ['hurt1', 'hurt2']), mob_zombie_death: soundPaths('mob/zombie', ['death']),
      mob_chicken_ambient: soundPaths('mob/chicken', ['say1', 'say2', 'say3']), mob_chicken_hurt: soundPaths('mob/chicken', ['hurt1', 'hurt2']), mob_chicken_death: soundPaths('mob/chicken', ['hurt1']),
      mob_sheep_ambient: soundPaths('mob/sheep', ['say1', 'say2', 'say3']), mob_sheep_hurt: soundPaths('mob/sheep', ['say1', 'say2']), mob_sheep_death: soundPaths('mob/sheep', ['say3']), mob_sheep_shear: soundPaths('mob/sheep', ['shear']),
      mob_cow_ambient: soundPaths('mob/cow', ['say1', 'say2', 'say3', 'say4']), mob_cow_hurt: soundPaths('mob/cow', ['hurt1', 'hurt2', 'hurt3']), mob_cow_death: soundPaths('mob/cow', ['hurt3']),
      mob_pig_ambient: soundPaths('mob/pig', ['say1', 'say2', 'say3']), mob_pig_hurt: soundPaths('mob/pig', ['say1', 'say2']), mob_pig_death: soundPaths('mob/pig', ['death']),
      mob_skeleton_ambient: soundPaths('mob/skeleton', ['say1', 'say2', 'say3']), mob_skeleton_hurt: soundPaths('mob/skeleton', ['hurt1', 'hurt2', 'hurt3', 'hurt4']), mob_skeleton_death: soundPaths('mob/skeleton', ['death']),
      mob_creeper_ambient: soundPaths('mob/creeper', ['say1', 'say2', 'say3', 'say4']), mob_creeper_hurt: soundPaths('mob/creeper', ['say1', 'say2']), mob_creeper_death: soundPaths('mob/creeper', ['death']),
      mob_villager_ambient: soundPaths('mob/villager', ['idle1', 'idle2', 'idle3']), mob_villager_hurt: soundPaths('mob/villager', ['hit1', 'hit2', 'hit3']), mob_villager_death: soundPaths('mob/villager', ['death']), mob_villager_yes: soundPaths('mob/villager', ['yes1']), mob_villager_no: soundPaths('mob/villager', ['no1']),
      mob_wolf_ambient: soundPaths('mob/wolf/classic', ['bark1', 'bark2', 'bark3']), mob_wolf_hurt: soundPaths('mob/wolf/classic', ['hurt1', 'hurt2', 'hurt3']), mob_wolf_death: soundPaths('mob/wolf/classic', ['death']),
      mob_cat_ambient: soundPaths('mob/cat', ['meow1', 'meow2', 'meow3', 'meow4']), mob_cat_hurt: soundPaths('mob/cat', ['hitt1', 'hitt2', 'hitt3']), mob_cat_death: soundPaths('mob/cat', ['hitt3']),
      mob_horse_ambient: soundPaths('mob/horse', ['idle1', 'idle2', 'idle3']), mob_horse_hurt: soundPaths('mob/horse', ['hit1', 'hit2', 'hit3']), mob_horse_death: soundPaths('mob/horse', ['death']),
      mob_bee_ambient: soundPaths('mob/bee', ['loop1', 'loop2', 'loop3']), mob_bee_hurt: soundPaths('mob/bee', ['hurt1', 'hurt2', 'hurt3']), mob_bee_death: soundPaths('mob/bee', ['death1', 'death2']),
      mob_pillager_ambient: soundPaths('mob/pillager', ['idle1', 'idle2', 'idle3', 'idle4']), mob_pillager_hurt: soundPaths('mob/pillager', ['hurt1', 'hurt2', 'hurt3']), mob_pillager_death: soundPaths('mob/pillager', ['death1', 'death2'])
    },
    init() {
      const resume = () => { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); this.updateListener(); };
      addEventListener('pointerdown', resume, { passive: true }); addEventListener('keydown', resume, { passive: true });
    },
    updateListener() {
      if (!this.ctx) return; const l = this.ctx.listener, d = Player.lookDir(), y = player.y + player.eyeHeight;
      if (l.positionX) { l.positionX.value = player.x; l.positionY.value = y; l.positionZ.value = player.z; l.forwardX.value = d[0]; l.forwardY.value = d[1]; l.forwardZ.value = d[2]; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
      else { l.setPosition(player.x, y, player.z); l.setOrientation(d[0], d[1], d[2], 0, 1, 0); }
    },
    spatialDestination(pos) {
      if (!pos || !this.ctx) return this.ctx.destination;
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.maxDistance = 42; p.rolloffFactor = 1.25;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      p.connect(this.ctx.destination); return p;
    },
    loadSample(url) {
      if (!this.buffers.has(url)) this.buffers.set(url, fetch(url, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(data => this.ctx.decodeAudioData(data)));
      return this.buffers.get(url);
    },
    playSample(name, pos, gain = 1) {
      if (!this.ctx || this.ctx.state !== 'running' || !this.samples[name]) return Promise.resolve(false);
      const list = this.samples[name], url = list[Math.floor(Math.random() * list.length)];
      return this.loadSample(url).then(buffer => { const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = buffer; src.playbackRate.value = 0.97 + Math.random() * 0.06; g.gain.value = this.volume * gain; src.connect(g); g.connect(this.spatialDestination(pos)); src.start(); return true; });
    },
    tone(freq, duration, type = 'square', gain = 0.08, slide = 1, pos = null) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);
      g.gain.setValueAtTime(gain * this.synthVolume, now); g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      o.connect(g); g.connect(this.spatialDestination(pos)); o.start(now); o.stop(now + duration);
    },
    noise(duration = 0.08, gain = 0.06, pos = null) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration)), buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = buffer; g.gain.value = gain * this.synthVolume; src.connect(g); g.connect(this.spatialDestination(pos)); src.start();
    },
    synth(name, pos) {
      if (name.startsWith('break')) this.noise(0.08, 0.3, pos);
      else if (name.startsWith('place')) this.tone(110, 0.05, 'square', 0.22, 0.75, pos);
      else if (name === 'hurt') { this.noise(0.12, 0.35, pos); this.tone(85, 0.13, 'sawtooth', 0.22, 0.6, pos); }
      else if (name === 'pickup') this.tone(780, 0.08, 'sine', 0.18, 1.35, pos);
      else if (name === 'level') { this.tone(520, 0.16, 'sine', 0.2, 1.5); setTimeout(() => this.tone(780, 0.2, 'sine', 0.2, 1.3), 90); }
      else if (name === 'bow') this.noise(0.09, 0.25, pos);
      else if (name === 'explosion') { this.noise(0.55, 0.7, pos); this.tone(70, 0.5, 'sawtooth', 0.3, 0.25, pos); }
      else if (name === 'water') this.noise(0.22, 0.16, pos);
      else if (name === 'machine') this.tone(150, 0.12, 'square', 0.15, 0.8, pos);
      else if (name === 'success') { this.tone(440, 0.12, 'sine', 0.18, 1.5); setTimeout(() => this.tone(660, 0.16, 'sine', 0.18, 1.25), 80); }
    },
    play(name, pos = null, gain = 1) {
      const now = performance.now(); if (now - (this.last[name] || 0) < 45) return; this.last[name] = now;
      if (this.samples[name]) this.playSample(name, pos, gain).catch(() => this.synth(name, pos)); else this.synth(name, pos);
    },
    playAt(name, x, y, z, gain = 1) { this.play(name, { x, y, z }, gain); }
  };
  SoundFX.init(); window.MinezeraSound = SoundFX;

  /* Advancements and recipe discovery */
  const AdvancementDefs = {
    stone_age: 'Idade da Pedra', acquire_hardware: 'Adquira Ferragem', fishy_business: 'Pescaria!',
    what_a_deal: 'Que Negocio!', enchanting: 'Encantador', local_brewery: 'Alquimia Local',
    best_friends: 'Melhores Amigos', mount_up: 'A Caminho', sky_is_limit: 'O Ceu e o Limite',
    bee_our_guest: 'Nossa Amiga Abelha', whos_the_pillager: 'Quem e o Saqueador?', modern_world: 'Picos Modernos'
  };
  const Advancements = {
    unlocked: {}, recipes: {}, key() { return 'minezera_adv_' + ((window.MINEZERA_PLAYER && window.MINEZERA_PLAYER.id) || 'local'); },
    load() { try { const d = JSON.parse(localStorage.getItem(this.key()) || '{}'); this.unlocked = d.unlocked || {}; this.recipes = d.recipes || {}; } catch (_) {} },
    save() { try { localStorage.setItem(this.key(), JSON.stringify({ unlocked: this.unlocked, recipes: this.recipes })); } catch (_) {} },
    grant(id) { if (this.unlocked[id]) return; this.unlocked[id] = Date.now(); this.save(); SoundFX.play('success'); HUD.message('Progresso concluido: ' + (AdvancementDefs[id] || prettify(id))); },
    discover(name) { if (!name || this.recipes[name]) return; this.recipes[name] = true; this.save(); HUD.message('Receita desbloqueada: ' + prettify(name)); },
    unlockFromIngredient(name) {
      const matches = spec => Array.isArray(spec) ? spec.includes(name) : typeof spec === 'string' && (spec === name || (spec.startsWith('tag:') && Tags[spec.slice(4)] && Tags[spec.slice(4)].includes(name)));
      for (const recipe of Recipes.shaped) if (recipe.cells.some(matches)) this.discover(recipe.result);
      for (const recipe of Recipes.shapeless) if (recipe.ingredients.some(matches)) this.discover(recipe.result);
    }
  };
  Advancements.load(); window.MinezeraAdvancements = Advancements;

  /* Potions and effects */
  const Effects = {
    apply(name, seconds, level = 0) { player.effects = player.effects || {}; player.effects[name] = { ticks: seconds * TICK_RATE, level }; HUD.message(prettify(name) + ' por ' + seconds + 's'); SoundFX.play('success'); },
    tick() {
      player.effects = player.effects || {};
      for (const [name, effect] of Object.entries(player.effects)) {
        effect.ticks--;
        if (name === 'regeneration' && effect.ticks % 40 === 0) player.health = Math.min(player.maxHealth, player.health + 1 + effect.level);
        if (name === 'poison' && effect.ticks % 40 === 0 && player.health > 1) Player.damage(1, 'was poisoned');
        if (name === 'fire_resistance' && player.fire > 0) player.fire = 0;
        if (effect.ticks <= 0) { delete player.effects[name]; HUD.message(prettify(name) + ' terminou'); }
      }
    }
  };
  const potionEffects = { potion_swiftness: ['speed', 180, 0], potion_strength: ['strength', 180, 0], potion_regeneration: ['regeneration', 90, 0], potion_fire_resistance: ['fire_resistance', 180, 0], potion_poison: ['poison', 45, 0] };
  for (const [name, effect] of Object.entries(potionEffects)) Items.get(name).onUse = () => { Effects.apply(...effect); if (!Player.isCreative()) Inventory.replaceHeld({ name: 'glass_bottle', count: 1 }); return true; };
  Items.get('honey_bottle').onUse = () => { if (player.effects) delete player.effects.poison; player.hunger = Math.min(PLAYER_MAX_HUNGER, player.hunger + 6); player.saturation = Math.min(player.hunger, player.saturation + 1.2); if (!Player.isCreative()) Inventory.replaceHeld({ name: 'glass_bottle', count: 1 }); SoundFX.play('success'); return true; };

  /* Fishing, compass, boats and elytra */
  const Fishing = { active: null,
    cast() {
      if (this.active) { this.active = null; HUD.message('Linha recolhida.'); return true; }
      const e = Player.eye(), d = Player.lookDir(), hit = Interaction.raycast(e[0], e[1], e[2], d[0], d[1], d[2], 22, true);
      if (!hit || world.getBlock(hit.x, hit.y, hit.z) !== B.water) { HUD.message('Mire em uma area de agua para pescar.'); return true; }
      this.active = { ticks: 60 + rng.int(100), x: hit.x + 0.5, y: hit.y + 0.8, z: hit.z + 0.5 }; SoundFX.playAt('water', this.active.x, this.active.y, this.active.z); HUD.message('Boia lancada...'); return true;
    },
    tick() { if (!this.active || --this.active.ticks > 0) return; const roll = rng.next(), item = roll < 0.03 ? 'saddle' : roll < 0.25 ? 'salmon' : 'cod'; give(item, 1); Player.gainExp(1 + rng.int(3)); if (Player.held() && Player.held().name === 'fishing_rod') Inventory.damageHeldTool(); this.active = null; SoundFX.play('pickup'); HUD.message('Voce pescou ' + Items.get(item).displayName + '!'); Advancements.grant('fishy_business'); }
  };
  Items.get('fishing_rod').onUse = () => Fishing.cast();
  Items.get('compass').onUse = () => { const dx = player.spawn[0] - player.x, dz = player.spawn[2] - player.z; const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'leste' : 'oeste') : (dz > 0 ? 'sul' : 'norte'); HUD.message(`Spawn: ${floor(player.spawn[0])}, ${floor(player.spawn[2])} - siga para ${dir}`); return true; };
  Items.get('elytra').onUse = () => { player.elytra = !player.elytra; HUD.message(player.elytra ? 'Elytra ativada: pule de um lugar alto.' : 'Elytra desativada.'); return true; };

  /* New mobs */
  Object.assign(MOB_TYPES, {
    villager: { w: 0.3, h: 1.9, health: 20, speed: 1.25, passive: true, drops: [], name: 'Villager' },
    pillager: { w: 0.3, h: 1.95, health: 24, speed: 2.4, hostile: true, ranged: true, damage: 4, drops: [['emerald', 0, 2], ['arrow', 0, 2]], name: 'Pillager' },
    wolf: { w: 0.35, h: 0.85, health: 12, speed: 2.5, passive: true, drops: [], name: 'Wolf' },
    cat: { w: 0.25, h: 0.7, health: 10, speed: 2.8, passive: true, drops: [], name: 'Cat' },
    horse: { w: 0.55, h: 1.7, health: 24, speed: 4.2, passive: true, drops: [['leather', 0, 2]], name: 'Horse' },
    bee: { w: 0.25, h: 0.45, health: 10, speed: 2.6, passive: true, drops: [], name: 'Bee' },
    boat: { w: 0.7, h: 0.45, health: 10, speed: 3.4, passive: true, drops: [['oak_boat', 1, 1]], name: 'Oak Boat' }
  });
  const originalBuildModel = Mobs.buildModel.bind(Mobs);
  Mobs.buildModel = function(m) {
    const real = m.type, alias = { pillager: 'skeleton', cat: 'pig', horse: 'cow', bee: 'chicken', boat: 'pig' }[real];
    if (alias) m.type = alias; originalBuildModel(m); m.type = real;
    const tint = { pillager: 0x778888, wolf: 0xaaa69c, cat: 0xd18b47, horse: 0x7a4b28, bee: 0xffc928, boat: 0x8d5a2b }[real];
    if (tint) m.mesh.traverse(o => { if (o.isMesh) { const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const mt of mats) if (!mt.map) mt.color.setHex(tint); o.userData.baseColors = mats.map(mt => mt.color.clone()); } });
    if (real === 'bee') m.mesh.scale.set(0.55, 0.55, 0.55);
    if (real === 'cat') m.mesh.scale.set(0.65, 0.65, 0.65);
    if (real === 'boat') m.mesh.scale.set(1.5, 0.45, 1.25);
  };
  const originalSpawnMob = Mobs.spawnMob.bind(Mobs);
  Mobs.spawnMob = function(type, x, y, z) { const m = originalSpawnMob(type, x, y, z); if (m) { m.tamed = false; m.owner = null; m.saddled = false; m.trades = null; } return m; };

  const spawnBoat = () => {
    const e = Player.eye(), d = Player.lookDir(), t = Interaction.raycast(e[0], e[1], e[2], d[0], d[1], d[2], 8, true);
    if (!t || world.getBlock(t.x, t.y, t.z) !== B.water) { HUD.message('Use o barco sobre a agua.'); return true; }
    const m = Mobs.spawnMob('boat', t.x + 0.5, t.y + 0.7, t.z + 0.5); if (m) { if (!Player.isCreative()) Inventory.consumeHeld(); SoundFX.playAt('water', m.x, m.y, m.z); }
    return true;
  };
  Items.get('oak_boat').onUse = spawnBoat;

  /* Machine processing */
  const Brewing = {
    recipes: { sugar: 'potion_swiftness', blaze_powder: 'potion_strength', ghast_tear: 'potion_regeneration', magma_cream: 'potion_fire_resistance', spider_eye: 'potion_poison' },
    create() { return { type: 'brewing', bottles: [null, null, null], ingredient: null, fuel: null, brew: 0 }; },
    tick(t) {
      const output = t.ingredient && this.recipes[t.ingredient.name], hasBottle = t.bottles.some(s => s && s.name === 'water_bottle');
      if (!output || !hasBottle) { t.brew = 0; return; }
      if (t.brew <= 0) { if (!t.fuel || t.fuel.name !== 'blaze_powder') return; t.fuel.count--; if (t.fuel.count <= 0) t.fuel = null; t.brew = 200; SoundFX.play('machine'); }
      if (--t.brew === 0) { for (let i = 0; i < 3; i++) if (t.bottles[i] && t.bottles[i].name === 'water_bottle') t.bottles[i] = { name: output, count: 1 }; t.ingredient.count--; if (t.ingredient.count <= 0) t.ingredient = null; SoundFX.play('success'); Advancements.grant('local_brewery'); }
    }
  };
  const BlastFurnace = { create() { return { type: 'blast_furnace', input: null, fuel: null, output: null, burn: 0, burnTotal: 0, cook: 0 }; }, tick(t) { if (!t.input || !/_ore$/.test(t.input.name)) { t.cook = 0; return; } const old = Furnace.COOK_TICKS; Furnace.COOK_TICKS = 100; Furnace.tick(t, -999999, 0, -999999); Furnace.COOK_TICKS = old; } };
  const tileArray = (tile, key) => tile[key] || (tile[key] = []);
  const transferOne = (from, to) => {
    for (let i = 0; i < from.length; i++) if (from[i]) { const one = copyStack(from[i], 1), left = Inventory.add(to, one); if (!left) { from[i].count--; if (from[i].count <= 0) from[i] = null; return true; } }
    return false;
  };
  const MachineTicks = {
    observerPulses: new Map(),
    tick() {
      Fishing.tick(); Effects.tick();
      for (const c of world.chunks.values()) {
        if (!c.tiles.size || Math.abs(c.cx - ChunkManager.pcx) > 4 || Math.abs(c.cz - ChunkManager.pcz) > 4) continue;
        for (const [i, t] of c.tiles) {
          const x = c.cx * 16 + (i >> 11), y = i & 127, z = c.cz * 16 + ((i >> 7) & 15);
          if (t.type === 'brewing') Brewing.tick(t);
          else if (t.type === 'blast_furnace') BlastFurnace.tick(t);
          else if (t.type === 'hopper' && Scheduler.tick % 8 === 0) {
            const src = world.getTile(x, y + 1, z), dst = world.getTile(x, y - 1, z);
            if (src && src.slots) transferOne(src.slots, t.slots);
            if (dst && dst.slots) transferOne(t.slots, dst.slots);
          }
        }
      }
      for (const [key, pulse] of [...this.observerPulses]) if (--pulse.ticks <= 0) { if (world.getBlock(pulse.x, pulse.y, pulse.z) === B.observer) { world.setMeta(pulse.x, pulse.y, pulse.z, world.getMeta(pulse.x, pulse.y, pulse.z) & 3); Redstone.onChange(pulse.x, pulse.y, pulse.z); } this.observerPulses.delete(key); }
      this.mobBehaviors();
    },
    mobBehaviors() {
      for (const m of Mobs.list) {
        if (m.dead) continue;
        if (m.type !== 'boat') {
          const near = dist2(m.x, m.y, m.z, player.x, player.y, player.z) <= 10 * 10;
          if (m.ambientSoundTicks === undefined) m.ambientSoundTicks = 20 + rng.int(40);
          if (!near) {
            m.ambientNear = false;
          } else {
            if (!m.ambientNear) {
              m.ambientNear = true;
              m.ambientSoundTicks = 20 + rng.int(40);
            }
            if (--m.ambientSoundTicks <= 0) {
              m.ambientSoundTicks = 200 + rng.int(320);
              SoundFX.playAt(`mob_${m.type}_ambient`, m.x, m.y + m.h * 0.65, m.z, m.type === 'bee' ? 0.45 : 0.82);
            }
          }
        }
        if (m.tamed && m.owner === 'player') {
          const d = Math.hypot(player.x - m.x, player.z - m.z);
          if (d > 3 && d < 35) { m.moveX = (player.x - m.x) / d; m.moveZ = (player.z - m.z) / d; m.state = 'follow'; m.stateTimer = 1; }
          if (d >= 35) { m.x = player.x + 1; m.y = player.y; m.z = player.z + 1; }
        }
        if (m.type === 'bee') { m.vy += Math.sin((m.age || 0) * 0.15) * 0.02; if (m.y < world.getHeight(floor(m.x), floor(m.z)) + 2) m.vy += 0.15; }
      }
    }
  };

  /* Custom screens */
  const proxySlot = (tile, key) => ({ get 0() { return tile[key]; }, set 0(v) { tile[key] = v; }, length: 1 });
  const stationButton = (action, label, disabled = false) => `<button class="btn small expansion-action" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  window.Expansion26UI = {
    render(type, screens) {
      const data = screens.data || {}, tile = data.x === undefined ? null : world.getTile(data.x, data.y, data.z);
      if (type === 'brewing' && tile) {
        screens.containers.bottles = tile.bottles; screens.containers.bingredient = proxySlot(tile, 'ingredient'); screens.containers.bfuel = proxySlot(tile, 'fuel');
        return `<h2>Brewing Stand</h2><div class="row">${screens.gridHTML('bottles', 3, 3)}<div class="col">Ingrediente${screens.slotHTML('bingredient', 0)}Combustivel${screens.slotHTML('bfuel', 0)}<small id="brew-progress"></small></div></div>${screens.playerInvHTML()}`;
      }
      if (type === 'blast_furnace' && tile) {
        screens.containers.fin = proxySlot(tile, 'input'); screens.containers.ffuel = proxySlot(tile, 'fuel'); screens.containers.fout = proxySlot(tile, 'output');
        return `<h2>Blast Furnace</h2><div class="row"><div class="col">${screens.slotHTML('fin', 0)}${screens.slotHTML('ffuel', 0)}</div><div class="arrow"><i id="blast-progress"></i></div>${screens.slotHTML('fout', 0, 'result')}</div>${screens.playerInvHTML()}`;
      }
      if ((type === 'hopper' || type === 'dispenser') && tile) { screens.containers.machine = tile.slots; return `<h2>${prettify(type)}</h2>${screens.gridHTML('machine', tile.slots.length, type === 'hopper' ? 5 : 3)}${screens.playerInvHTML()}`; }
      if (type === 'enchanting') return `<h2>Enchanting Table</h2><p>Encante o item selecionado. Custa lapis-lazuli e niveis.</p><div class="row">${stationButton('enchant_efficiency', 'Efficiency I (1 lapis / 1 nivel)')}${stationButton('enchant_sharpness', 'Sharpness I (2 / 2)')}${stationButton('enchant_unbreaking', 'Unbreaking I (3 / 3)')}</div>${screens.playerInvHTML()}`;
      if (type === 'stonecutter') return `<h2>Stonecutter</h2><p>Converte uma pedra do inventario.</p><div class="row">${stationButton('cut_stone_bricks', 'Stone Bricks')}${stationButton('cut_stone_slab', 'Cobblestone x2')}</div>${screens.playerInvHTML()}`;
      if (type === 'smithing') return `<h2>Smithing Table</h2><p>Segure uma armadura. Consome 1 Coast Trim e 1 material.</p><div class="row">${stationButton('trim_iron', 'Acabamento Iron')}${stationButton('trim_gold', 'Acabamento Gold')}${stationButton('trim_diamond', 'Acabamento Diamond')}</div>${screens.playerInvHTML()}`;
      if (type === 'hive') return `<h2>Colmeia</h2><p>Abelhas produzem mel com o tempo.</p><small id="hive-honey"></small>${stationButton('collect_honey', 'Coletar mel')}${screens.playerInvHTML()}`;
      if (type === 'trading') {
        const m = data.mob, trades = this.trades(m);
        return `<h2>Villager Trading</h2><div class="col">${trades.map((t, i) => stationButton('trade_' + i, `${t.cost} ${prettify(t.pay)} -> ${t.count} ${prettify(t.get)}`)).join('')}</div>${screens.playerInvHTML()}`;
      }
      if (type === 'advancements') return `<h2>Advancements</h2><div class="col">${Object.entries(AdvancementDefs).map(([id, title]) => `<div style="padding:7px;background:${Advancements.unlocked[id] ? '#6a4' : '#777'};border:1px solid #333">${Advancements.unlocked[id] ? '✓' : '□'} ${title}</div>`).join('')}</div><h3>Receitas desbloqueadas (${Object.keys(Advancements.recipes).length})</h3><small>${Object.keys(Advancements.recipes).map(prettify).join(' · ') || 'Colete itens e fabrique para descobrir receitas.'}</small>`;
      return '';
    },
    trades(m) { if (!m.trades) m.trades = [{ pay: 'wheat', cost: 20, get: 'emerald', count: 1 }, { pay: 'emerald', cost: 3, get: 'bread', count: 6 }, { pay: 'emerald', cost: 4, get: 'blaze_powder', count: 2 }, { pay: 'emerald', cost: 3, get: 'quartz', count: 4 }, { pay: 'emerald', cost: 5, get: 'slime_ball', count: 2 }, { pay: 'emerald', cost: 7, get: 'coast_armor_trim_smithing_template', count: 1 }, { pay: 'emerald', cost: 8, get: 'saddle', count: 1 }, { pay: 'emerald', cost: 32, get: 'elytra', count: 1 }]; return m.trades; },
    bind(type, panel, screens) { panel.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => { this.action(b.dataset.action, type, screens); })); },
    refresh(type, screens) {
      if (type === 'brewing') { const t = world.getTile(screens.data.x, screens.data.y, screens.data.z), el = $('brew-progress'); if (t && el) el.textContent = t.brew ? `Preparando: ${Math.ceil(t.brew / 20)}s` : 'Pronto'; }
      if (type === 'blast_furnace') { const t = world.getTile(screens.data.x, screens.data.y, screens.data.z), el = $('blast-progress'); if (t && el) el.style.width = Math.min(100, t.cook) + '%'; }
      if (type === 'hive') { const t = world.getTile(screens.data.x, screens.data.y, screens.data.z), el = $('hive-honey'); if (t && el) el.textContent = `Mel: ${t.honey || 0}/3`; }
    },
    action(action, type, screens) {
      if (action.startsWith('enchant_')) {
        const kind = action.slice(8), held = Player.held(), costs = { efficiency: [1, 1], sharpness: [2, 2], unbreaking: [3, 3] }, c = costs[kind];
        if (!held || !Items.get(held.name) || (!Items.get(held.name).tool && Items.get(held.name).type !== 'weapon')) return HUD.message('Selecione uma ferramenta ou arma.');
        if (!Player.isCreative() && (player.level <= c[1] || Inventory.count(player.inventory, 'lapis_lazuli') < c[0])) return HUD.message('Lapis ou niveis insuficientes.');
        if (!Player.isCreative()) { Inventory.removeItem(player.inventory, 'lapis_lazuli', c[0]); player.level -= c[1]; }
        held.ench = held.ench || {}; held.ench[kind] = Math.min(5, (held.ench[kind] || 0) + 1); SoundFX.play('success'); Advancements.grant('enchanting'); HUD.message('Item encantado com ' + prettify(kind));
      } else if (action.startsWith('cut_')) {
        if (!consumeNamed('stone', 1)) return HUD.message('Voce precisa de Stone.');
        give(action === 'cut_stone_bricks' ? 'stone_bricks' : 'cobblestone', action === 'cut_stone_bricks' ? 1 : 2); SoundFX.play('machine');
      } else if (action.startsWith('trim_')) {
        const material = action.slice(5), held = Player.held();
        if (!held || !/_(chestplate|leggings|helmet|boots)$/.test(held.name)) return HUD.message('Segure uma armadura.');
        const materialItem = material === 'iron' ? 'iron_ingot' : material === 'gold' ? 'gold_ingot' : 'diamond';
        if (!Player.isCreative() && (Inventory.count(player.inventory, 'coast_armor_trim_smithing_template') < 1 || Inventory.count(player.inventory, materialItem) < 1)) return HUD.message('Faltam template ou material.');
        consumeNamed('coast_armor_trim_smithing_template', 1); consumeNamed(materialItem, 1);
        held.trim = { pattern: 'coast', material }; SoundFX.play('success'); HUD.message('Acabamento aplicado.');
      } else if (action === 'collect_honey') {
        const tile = world.getTile(screens.data.x, screens.data.y, screens.data.z); if (!tile) return;
        if (tile.honey <= 0 || !consumeNamed('glass_bottle', 1)) return HUD.message('A colmeia ainda nao tem mel ou faltam garrafas.');
        tile.honey--; give('honey_bottle', 1); SoundFX.play('success'); Advancements.grant('bee_our_guest');
      } else if (action.startsWith('trade_')) {
        const t = this.trades(screens.data.mob)[+action.slice(6)]; if (!consumeNamed(t.pay, t.cost)) return HUD.message('Itens insuficientes para a troca.');
        give(t.get, t.count); SoundFX.playAt('mob_villager_yes', screens.data.mob.x, screens.data.mob.y + 1.4, screens.data.mob.z); Advancements.grant('what_a_deal');
      }
      HUD.refreshHotbar(); screens.render();
    }
  };

  /* Integrate new interactions */
  const originalInteract = Interaction.interact.bind(Interaction);
  Interaction.interact = function(def, x, y, z) {
    if (def.interactive === 'brewing') { if (!world.getTile(x, y, z)) world.setTile(x, y, z, Brewing.create()); Screens.open('brewing', { x, y, z }); }
    else if (def.interactive === 'blast_furnace') { if (!world.getTile(x, y, z)) world.setTile(x, y, z, BlastFurnace.create()); Screens.open('blast_furnace', { x, y, z }); }
    else if (def.interactive === 'hopper') { if (!world.getTile(x, y, z)) world.setTile(x, y, z, { type: 'hopper', slots: new Array(5).fill(null) }); Screens.open('hopper', { x, y, z }); }
    else if (def.interactive === 'dispenser') { if (!world.getTile(x, y, z)) world.setTile(x, y, z, { type: 'dispenser', slots: new Array(9).fill(null) }); Screens.open('dispenser', { x, y, z }); }
    else if (['enchanting', 'stonecutter', 'smithing'].includes(def.interactive)) Screens.open(def.interactive, { x, y, z });
    else if (def.interactive === 'hive') { if (!world.getTile(x, y, z)) world.setTile(x, y, z, { type: 'hive', honey: 3 }); Screens.open('hive', { x, y, z }); }
    else originalInteract(def, x, y, z);
  };
  const originalUse = Interaction.use.bind(Interaction);
  Interaction.use = function() {
    const m = this.targetMob, held = Player.held();
    if (!m) return originalUse();
    if (m.type === 'villager') { Screens.open('trading', { mob: m }); return; }
    if (m.type === 'wolf' && held && held.name === 'bone') { Inventory.consumeHeld(); if (rng.chance(0.6)) { m.tamed = true; m.owner = 'player'; SoundFX.play('success'); Advancements.grant('best_friends'); HUD.message('Lobo domesticado!'); } else HUD.message('O lobo ainda esta desconfiado.'); return; }
    if (m.type === 'cat' && held && (held.name === 'cod' || held.name === 'salmon')) { Inventory.consumeHeld(); m.tamed = true; m.owner = 'player'; SoundFX.play('success'); Advancements.grant('best_friends'); HUD.message('Gato domesticado!'); return; }
    if (m.type === 'horse') { if (held && held.name === 'saddle' && !m.saddled) { Inventory.consumeHeld(); m.saddled = true; HUD.message('Sela colocada.'); return; } if (m.saddled) { player.riding = m; HUD.message('Montado. Pressione R para desmontar.'); Advancements.grant('mount_up'); return; } }
    if (m.type === 'boat') { player.riding = m; HUD.message('No barco. Pressione R para sair.'); return; }
    return originalUse();
  };

  /* Player movement extensions */
  const originalPlayerUpdate = Player.update.bind(Player);
  Player.update = function(dt) {
    originalPlayerUpdate(dt);
    SoundFX.updateListener();
    const speedBoost = player.effects && player.effects.speed ? 1.2 + player.effects.speed.level * 0.2 : 1;
    if (speedBoost > 1) { player.vx *= speedBoost; player.vz *= speedBoost; }
    if (player.elytra && !player.onGround && !player.inWater && !player.flying && player.vy < -0.5) { const f = this.forward(); player.vy = Math.max(player.vy, -2.1); player.vx += f[0] * dt * 4; player.vz += f[2] * dt * 4; if (!player.elytraUsed) { player.elytraUsed = true; Advancements.grant('sky_is_limit'); } }
    if (player.y > 95) Advancements.grant('modern_world');
    if (player.onGround) player.elytraUsed = false;
    if (player.riding && !player.riding.dead) { const m = player.riding, water = m.type === 'boat'; m.x = player.x; m.z = player.z; m.y = player.y - (water ? 0.35 : 0.15); m.moveX = m.moveZ = 0; const mult = m.type === 'horse' ? 1.45 : 1.15; player.vx *= mult; player.vz *= mult; }
    const movementCap = (player.riding ? (player.riding.type === 'horse' ? 8.8 : 5.8) : (player.sprinting ? 6.8 : 5.3)) * speedBoost;
    const horizontalSpeed = Math.hypot(player.vx, player.vz); if (!player.flying && horizontalSpeed > movementCap) { player.vx *= movementCap / horizontalSpeed; player.vz *= movementCap / horizontalSpeed; }
  };
  const originalDamage = Player.damage.bind(Player);
  Player.damage = function(amount, cause, knock) { if (player.effects && player.effects.fire_resistance && /lava|flame|burn|fire/.test(cause || '')) return; const hp = player.health; originalDamage(amount, cause, knock); if (player.health < hp) SoundFX.play('hurt'); };
  const originalGainExp = Player.gainExp.bind(Player);
  Player.gainExp = function(amount) { const level = player.level; originalGainExp(amount); if (player.level > level) SoundFX.play('level'); };
  Events.on('keypress', code => {
    if (code === 'KeyL' && Game.running && !Game.paused) Screens.open('advancements');
    if (code === 'KeyR' && player.riding) { player.riding = null; HUD.message('Voce desmontou.'); }
  });

  /* Redstone extensions */
  const originalIsComponent = Redstone.isComponent.bind(Redstone), originalIsPowered = Redstone.isPowered.bind(Redstone), originalSourceLevel = Redstone.sourceLevel.bind(Redstone), originalConsumer = Redstone.updateConsumer.bind(Redstone);
  const redstoneIds = () => [B.observer, B.repeater, B.comparator, B.dispenser, B.piston, B.sticky_piston, B.powered_rail, B.detector_rail, B.activator_rail];
  Redstone.isComponent = function(id) { return originalIsComponent(id) || redstoneIds().includes(id); };
  Redstone.isPowered = function(x, y, z) { if (originalIsPowered(x, y, z)) return true; for (const d of DIRS) { const id = world.getBlock(x + d[0], y + d[1], z + d[2]), m = world.getMeta(x + d[0], y + d[1], z + d[2]); if ((id === B.observer || id === B.repeater || id === B.comparator) && (m & 4)) return true; } return false; };
  Redstone.sourceLevel = function(x, y, z) { let p = originalSourceLevel(x, y, z); for (const d of DIRS) { const id = world.getBlock(x + d[0], y + d[1], z + d[2]), m = world.getMeta(x + d[0], y + d[1], z + d[2]); if ((id === B.observer || id === B.repeater || id === B.comparator) && (m & 4)) p = 15; } return p; };
  const fireDispenser = (x, y, z, tile, meta) => { const slot = tile && tile.slots.findIndex(Boolean); if (slot < 0) return; const s = tile.slots[slot], d = HDIRS[meta & 3], ex = x + 0.5 + d[0] * 0.7, ez = z + 0.5 + d[2] * 0.7; if (s.name === 'arrow') Entities.spawnArrow(ex, y + 0.6, ez, d[0] * 18, 1, d[2] * 18, 'dispenser', 4); else Entities.spawnItem(ex, y + 0.6, ez, copyStack(s, 1), d[0] * 5, 2, d[2] * 5, 30); s.count--; if (s.count <= 0) tile.slots[slot] = null; };
  const movePiston = (x, y, z, id, meta, powered) => {
    const extended = !!(meta & 4), d = HDIRS[meta & 3]; if (powered === extended) return;
    const fx = x + d[0], fz = z + d[2], tx = fx + d[0], tz = fz + d[2];
    if (powered) { const front = world.getBlock(fx, y, fz); if (front !== AIR && world.getBlock(tx, y, tz) === AIR && Blocks.byId[front].hardness >= 0 && !Blocks.byId[front].tileEntity) { world.setBlock(tx, y, tz, front, world.getMeta(fx, y, fz)); world.setBlock(fx, y, fz, AIR); } world.setMeta(x, y, z, meta | 4); }
    else { if (id === B.sticky_piston && world.getBlock(fx, y, fz) === AIR && world.getBlock(tx, y, tz) !== AIR && !world.getDef(tx, y, tz).tileEntity) { world.setBlock(fx, y, fz, world.getBlock(tx, y, tz), world.getMeta(tx, y, tz)); world.setBlock(tx, y, tz, AIR); } world.setMeta(x, y, z, meta & 3); }
    SoundFX.playAt('machine', x + 0.5, y + 0.5, z + 0.5);
  };
  Redstone.updateConsumer = function(x, y, z) {
    const id = world.getBlock(x, y, z), meta = world.getMeta(x, y, z), power = this.isPowered(x, y, z);
    if (id === B.repeater || id === B.comparator) { if (power !== !!(meta & 4)) { world.setMeta(x, y, z, power ? meta | 4 : meta & 3); this.onChange(x, y, z); } return; }
    if (id === B.dispenser) { const tile = world.getTile(x, y, z); if (power && !(meta & 4)) { world.setMeta(x, y, z, meta | 4); fireDispenser(x, y, z, tile, meta); } else if (!power && (meta & 4)) world.setMeta(x, y, z, meta & 3); return; }
    if (id === B.powered_rail || id === B.activator_rail) { world.setMeta(x, y, z, power ? meta | 4 : meta & 3); return; }
    if (id === B.piston || id === B.sticky_piston) { movePiston(x, y, z, id, meta, power); return; }
    originalConsumer(x, y, z);
  };
  Events.on('blockChanged', (x, y, z, oldId, newId) => {
    const near = dist2(x, y, z, player.x, player.y, player.z) < 100;
    if (near && Game.running && Game.ready && !Blocks.byId[oldId].liquid && !Blocks.byId[newId].liquid) {
      const def = Blocks.byId[newId === AIR ? oldId : newId], material = def.tool === 'axe' ? 'wood' : (def.tool === 'shovel' || def.id === B.grass_block || def.id === B.dirt) ? 'grass' : 'stone';
      SoundFX.playAt(`${newId === AIR ? 'break' : 'place'}_${material}`, x + 0.5, y + 0.5, z + 0.5, newId === AIR ? 0.9 : 0.65);
    }
    for (const d of DIRS) { const ox = x + d[0], oy = y + d[1], oz = z + d[2]; if (world.getBlock(ox, oy, oz) === B.observer) { const m = world.getMeta(ox, oy, oz); world.setMeta(ox, oy, oz, m | 4); MachineTicks.observerPulses.set(posKey(ox, oy, oz), { x: ox, y: oy, z: oz, ticks: 4 }); Redstone.onChange(ox, oy, oz); } }
  });

  /* Modern mountain profile for newly generated chunks. */
  const originalTerrainSample = Terrain.sample.bind(Terrain);
  Terrain.sample = function(x, z) {
    const s = originalTerrainSample(x, z);
    if (s.mountain > 0.16 && s.h > SEA_LEVEL + 4) {
      const jagged = this.nRidge.ridge2(x * 0.012, z * 0.012, 3), detail = this.nDetail.fbm2(x * 0.026, z * 0.026, 3);
      const boost = smoothstep(0.16, 0.7, s.mountain) * (jagged * 15 + detail * 4);
      s.h = floor(clamp(s.h + boost, 4, CHUNK_H - 6)); if (s.h > 78) s.biome = BIO_MOUNTAINS;
    }
    return s;
  };
  const originalDecorate = Terrain.decorateChunk.bind(Terrain);
  Terrain.decorateChunk = function(c, cols) {
    originalDecorate(c, cols);
    const r = this.chunkRand(c.cx, c.cz, 'bees-26.2'); if (!r.chance(0.08)) return;
    for (let tries = 0; tries < 80; tries++) {
      const x = 1 + r.int(14), z = 1 + r.int(14), h = cols[x * 16 + z].h;
      for (let y = h + 2; y < Math.min(CHUNK_H - 2, h + 9); y++) {
        const id = c.blocks[bidx(x, y, z)]; if (id !== B.oak_log && id !== B.birch_log) continue;
        const nx = x + 1; if (c.blocks[bidx(nx, y, z)] !== AIR) continue;
        c.blocks[bidx(nx, y, z)] = B.bee_nest; c.meta[bidx(nx, y, z)] = 1;
        c.tiles.set(bidx(nx, y, z), { type: 'hive', honey: r.int(3) }); c.recomputeHeights(); return;
      }
    }
  };

  /* Hooks, natural spawning and cleanup */
  const originalBreak = Interaction.breakBlock.bind(Interaction);
  Interaction.breakBlock = function(x, y, z, drop, held) { const id = world.getBlock(x, y, z); const r = originalBreak(x, y, z, drop, held); if (id === B.stone || id === B.cobblestone) Advancements.grant('stone_age'); if (id === B.iron_ore) Advancements.grant('acquire_hardware'); return r; };
  const originalConsumeCraft = Screens.consumeCraft.bind(Screens);
  Screens.consumeCraft = function() { const out = this.result[0]; originalConsumeCraft(); if (out) Advancements.discover(out.name); };
  const originalAddPlayer = Inventory.addToPlayer.bind(Inventory);
  Inventory.addToPlayer = function(stack) { const before = stack.count, left = originalAddPlayer(stack); if (left < before) { SoundFX.play('pickup'); Advancements.unlockFromIngredient(stack.name); } return left; };
  const originalExplosion = Entities.explode.bind(Entities); Entities.explode = function(x, y, z, ...args) { SoundFX.playAt('explosion', x, y, z, 1.05); return originalExplosion(x, y, z, ...args); };
  const originalArrow = Entities.spawnArrow.bind(Entities); Entities.spawnArrow = function(x, y, z, ...args) { SoundFX.playAt('bow', x, y, z, 0.72); return originalArrow(x, y, z, ...args); };
  const originalMobHurt = Mobs.hurt.bind(Mobs); Mobs.hurt = function(m, amount, ...args) { SoundFX.playAt(`mob_${m.type}_${m.health - amount <= 0 ? 'death' : 'hurt'}`, m.x, m.y + m.h * 0.65, m.z); return originalMobHurt(m, amount, ...args); };
  const originalShear = Mobs.shear.bind(Mobs); Mobs.shear = function(m) { const result = originalShear(m); if (result) SoundFX.playAt('mob_sheep_shear', m.x, m.y + 0.7, m.z); return result; };
  const originalKill = Mobs.kill.bind(Mobs); Mobs.kill = function(m, source) { originalKill(m, source); if (source === 'player' && m.type === 'pillager') Advancements.grant('whos_the_pillager'); };
  Events.on('tileRemoved', (x, y, z, tile) => { const drop = s => { if (s) Entities.spawnItem(x + 0.5, y + 0.5, z + 0.5, s); }; if (tile.type === 'brewing') { tile.bottles.forEach(drop); drop(tile.ingredient); drop(tile.fuel); } else if (tile.type === 'blast_furnace') { drop(tile.input); drop(tile.fuel); drop(tile.output); } else if (tile.slots) tile.slots.forEach(drop); });
  Events.on('tick', () => {
    MachineTicks.tick();
    if (Scheduler.tick % 100 !== 0 || !Game.running || Mobs.list.length > 45) return;
    const type = rng.pick(['villager', 'wolf', 'cat', 'horse', 'bee', 'pillager']), x = floor(player.x) + rng.irange(-30, 30), z = floor(player.z) + rng.irange(-30, 30), y = world.getHeight(x, z);
    if (type === 'pillager' && Sky.dayFactor > 0.5 && rng.chance(0.6)) return;
    if (Mobs.canStand(x, y, z, MOB_TYPES[type]) && world.getBlock(x, y - 1, z) === B.grass_block) Mobs.spawnMob(type, x + 0.5, y, z + 0.5);
  });
  Events.on('tick', () => { if (Scheduler.tick % 1200 === 0) for (const c of world.chunks.values()) for (const [, t] of c.tiles) if (t.type === 'hive') t.honey = Math.min(3, (t.honey || 0) + 1); });

  const style = document.createElement('style');
  style.textContent = '.expansion-action{margin:4px;white-space:normal;max-width:230px}#screen-panel small{font:11px monospace;color:#333}#screen-panel .col{gap:6px}';
  document.head.appendChild(style);
  window.MINEZERA_EXPANSION_VERSION = '26.2.13';
})();
