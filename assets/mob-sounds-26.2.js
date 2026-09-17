(function (root, factory) {
  const specs = factory();
  if (typeof module === 'object' && module.exports) module.exports = specs;
  else root.MINEZERA_MOB_SOUND_SPECS = specs;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    pig: { ambient: ['mob/pig/say1', 'mob/pig/say2', 'mob/pig/say3'], hurt: ['mob/pig/say1', 'mob/pig/say2'], death: ['mob/pig/death'] },
    cow: { ambient: ['mob/cow/say1', 'mob/cow/say2', 'mob/cow/say3', 'mob/cow/say4'], hurt: ['mob/cow/hurt1', 'mob/cow/hurt2', 'mob/cow/hurt3'], death: ['mob/cow/hurt3'] },
    sheep: { ambient: ['mob/sheep/say1', 'mob/sheep/say2', 'mob/sheep/say3'], hurt: ['mob/sheep/say1', 'mob/sheep/say2'], death: ['mob/sheep/say3'], shear: ['mob/sheep/shear'] },
    chicken: { ambient: ['mob/chicken/say1', 'mob/chicken/say2', 'mob/chicken/say3'], hurt: ['mob/chicken/hurt1', 'mob/chicken/hurt2'], death: ['mob/chicken/hurt1'] },
    zombie: { ambient: ['mob/zombie/say1', 'mob/zombie/say2', 'mob/zombie/say3'], hurt: ['mob/zombie/hurt1', 'mob/zombie/hurt2'], death: ['mob/zombie/death'] },
    skeleton: { ambient: ['mob/skeleton/say1', 'mob/skeleton/say2', 'mob/skeleton/say3'], hurt: ['mob/skeleton/hurt1', 'mob/skeleton/hurt2', 'mob/skeleton/hurt3', 'mob/skeleton/hurt4'], death: ['mob/skeleton/death'] },
    creeper: { ambient: ['mob/creeper/say1', 'mob/creeper/say2', 'mob/creeper/say3', 'mob/creeper/say4'], hurt: ['mob/creeper/say1', 'mob/creeper/say2'], death: ['mob/creeper/death'] },
    villager: { ambient: ['mob/villager/idle1', 'mob/villager/idle2', 'mob/villager/idle3'], hurt: ['mob/villager/hit1', 'mob/villager/hit2', 'mob/villager/hit3'], death: ['mob/villager/death'], yes: ['mob/villager/yes1'], no: ['mob/villager/no1'] },
    pillager: { ambient: ['mob/pillager/idle1', 'mob/pillager/idle2', 'mob/pillager/idle3', 'mob/pillager/idle4'], hurt: ['mob/pillager/hurt1', 'mob/pillager/hurt2', 'mob/pillager/hurt3'], death: ['mob/pillager/death1', 'mob/pillager/death2'] },
    wolf: { ambient: ['mob/wolf/classic/bark1', 'mob/wolf/classic/bark2', 'mob/wolf/classic/bark3'], hurt: ['mob/wolf/classic/hurt1', 'mob/wolf/classic/hurt2', 'mob/wolf/classic/hurt3'], death: ['mob/wolf/classic/death'] },
    cat: { ambient: ['mob/cat/meow1', 'mob/cat/meow2', 'mob/cat/meow3', 'mob/cat/meow4'], hurt: ['mob/cat/hitt1', 'mob/cat/hitt2', 'mob/cat/hitt3'], death: ['mob/cat/hitt3'] },
    horse: { ambient: ['mob/horse/idle1', 'mob/horse/idle2', 'mob/horse/idle3'], hurt: ['mob/horse/hit1', 'mob/horse/hit2', 'mob/horse/hit3'], death: ['mob/horse/death'] },
    bee: { ambient: ['mob/bee/loop1', 'mob/bee/loop2', 'mob/bee/loop3'], hurt: ['mob/bee/hurt1', 'mob/bee/hurt2', 'mob/bee/hurt3'], death: ['mob/bee/death1', 'mob/bee/death2'] },
    zombie_villager: { ambient: ['mob/zombie_villager/say1', 'mob/zombie_villager/say2', 'mob/zombie_villager/say3'], hurt: ['mob/zombie_villager/hurt1', 'mob/zombie_villager/hurt2'], death: ['mob/zombie_villager/death'] },
    husk: { ambient: ['mob/husk/idle1', 'mob/husk/idle2', 'mob/husk/idle3'], hurt: ['mob/husk/hurt1', 'mob/husk/hurt2'], death: ['mob/husk/death1', 'mob/husk/death2'] },
    drowned: { ambient: ['mob/drowned/idle1', 'mob/drowned/idle2', 'mob/drowned/idle3', 'mob/drowned/idle4', 'mob/drowned/idle5'], hurt: ['mob/drowned/hurt1', 'mob/drowned/hurt2', 'mob/drowned/hurt3'], death: ['mob/drowned/death1', 'mob/drowned/death2'] },
    witch: { ambient: ['entity/witch/ambient1', 'entity/witch/ambient2', 'entity/witch/ambient3', 'entity/witch/ambient4', 'entity/witch/ambient5'], hurt: ['entity/witch/hurt1', 'entity/witch/hurt2', 'entity/witch/hurt3'], death: ['entity/witch/death1', 'entity/witch/death2', 'entity/witch/death3'] },
    enderman: { ambient: ['mob/endermen/idle1', 'mob/endermen/idle2', 'mob/endermen/idle3', 'mob/endermen/idle4', 'mob/endermen/idle5'], hurt: ['mob/endermen/hit1', 'mob/endermen/hit2', 'mob/endermen/hit3', 'mob/endermen/hit4'], death: ['mob/endermen/death'] },
    blaze: { ambient: ['mob/blaze/breathe1', 'mob/blaze/breathe2', 'mob/blaze/breathe3', 'mob/blaze/breathe4'], hurt: ['mob/blaze/hit1', 'mob/blaze/hit2', 'mob/blaze/hit3', 'mob/blaze/hit4'], death: ['mob/blaze/death'] },
    ghast: { ambient: ['mob/ghast/moan1', 'mob/ghast/moan2', 'mob/ghast/moan3', 'mob/ghast/moan4', 'mob/ghast/moan5'], hurt: ['mob/ghast/scream1', 'mob/ghast/scream2', 'mob/ghast/scream3'], death: ['mob/ghast/death'] },
    spider: { ambient: ['mob/spider/say1', 'mob/spider/say2', 'mob/spider/say3', 'mob/spider/say4'], hurt: ['mob/spider/say1', 'mob/spider/say2', 'mob/spider/say3'], death: ['mob/spider/death'] },
    cave_spider: { ambient: ['mob/spider/say1', 'mob/spider/say2', 'mob/spider/say3', 'mob/spider/say4'], hurt: ['mob/spider/say1', 'mob/spider/say2', 'mob/spider/say3'], death: ['mob/spider/death'] },
    slime: { ambient: ['mob/slime/big1', 'mob/slime/big2', 'mob/slime/big3', 'mob/slime/big4'], hurt: ['mob/slime/big1', 'mob/slime/big2', 'mob/slime/big3'], death: ['mob/slime/big4'] },
    magma_cube: { ambient: ['mob/magmacube/big1', 'mob/magmacube/big2', 'mob/magmacube/big3', 'mob/magmacube/big4'], hurt: ['mob/magmacube/big1', 'mob/magmacube/big2', 'mob/magmacube/big3'], death: ['mob/magmacube/big4'] },
    silverfish: { ambient: ['mob/silverfish/say1', 'mob/silverfish/say2', 'mob/silverfish/say3', 'mob/silverfish/say4'], hurt: ['mob/silverfish/hit1', 'mob/silverfish/hit2', 'mob/silverfish/hit3'], death: ['mob/silverfish/kill'] },
    guardian: { ambient: ['mob/guardian/guardian_idle1', 'mob/guardian/guardian_idle2', 'mob/guardian/guardian_idle3', 'mob/guardian/guardian_idle4'], hurt: ['mob/guardian/guardian_hit1', 'mob/guardian/guardian_hit2', 'mob/guardian/guardian_hit3'], death: ['mob/guardian/guardian_death'] },
    phantom: { ambient: ['mob/phantom/idle1', 'mob/phantom/idle2', 'mob/phantom/idle3', 'mob/phantom/idle4', 'mob/phantom/idle5'], hurt: ['mob/phantom/hurt1', 'mob/phantom/hurt2', 'mob/phantom/hurt3'], death: ['mob/phantom/death1', 'mob/phantom/death2', 'mob/phantom/death3'] },
    polar_bear: { ambient: ['mob/polarbear/idle1', 'mob/polarbear/idle2', 'mob/polarbear/idle3', 'mob/polarbear/idle4'], hurt: ['mob/polarbear/hurt1', 'mob/polarbear/hurt2', 'mob/polarbear/hurt3'], death: ['mob/polarbear/death1', 'mob/polarbear/death2', 'mob/polarbear/death3'] },
    rabbit: { ambient: ['mob/rabbit/idle1', 'mob/rabbit/idle2', 'mob/rabbit/idle3', 'mob/rabbit/idle4'], hurt: ['mob/rabbit/hurt1', 'mob/rabbit/hurt2', 'mob/rabbit/hurt3'], death: ['mob/rabbit/bunnymurder'] },
    bat: { ambient: ['mob/bat/idle1', 'mob/bat/idle2', 'mob/bat/idle3', 'mob/bat/idle4'], hurt: ['mob/bat/hurt1', 'mob/bat/hurt2', 'mob/bat/hurt3'], death: ['mob/bat/death'] },
    iron_golem: { ambient: ['mob/irongolem/walk1', 'mob/irongolem/walk2', 'mob/irongolem/walk3', 'mob/irongolem/walk4'], hurt: ['mob/irongolem/hit1', 'mob/irongolem/hit2', 'mob/irongolem/hit3'], death: ['mob/irongolem/death'] },
    wandering_trader: { ambient: ['mob/wandering_trader/idle1', 'mob/wandering_trader/idle2', 'mob/wandering_trader/idle3', 'mob/wandering_trader/idle4'], hurt: ['mob/wandering_trader/hurt1', 'mob/wandering_trader/hurt2', 'mob/wandering_trader/hurt3'], death: ['mob/wandering_trader/death'] },
    goat: { ambient: ['mob/goat/idle1', 'mob/goat/idle2', 'mob/goat/idle3', 'mob/goat/idle4'], hurt: ['mob/goat/hurt1', 'mob/goat/hurt2', 'mob/goat/hurt3'], death: ['mob/goat/death1', 'mob/goat/death2', 'mob/goat/death3'] },
    fox: { ambient: ['mob/fox/idle1', 'mob/fox/idle2', 'mob/fox/idle3', 'mob/fox/idle4'], hurt: ['mob/fox/hurt1', 'mob/fox/hurt2', 'mob/fox/hurt3'], death: ['mob/fox/death1', 'mob/fox/death2'] },
    wither_skeleton: { ambient: ['mob/wither_skeleton/idle1', 'mob/wither_skeleton/idle2', 'mob/wither_skeleton/idle3'], hurt: ['mob/wither_skeleton/hurt1', 'mob/wither_skeleton/hurt2', 'mob/wither_skeleton/hurt3'], death: ['mob/wither_skeleton/death1', 'mob/wither_skeleton/death2'] },
    piglin: { ambient: ['mob/piglin/idle1', 'mob/piglin/idle2', 'mob/piglin/idle3', 'mob/piglin/idle4'], hurt: ['mob/piglin/hurt1', 'mob/piglin/hurt2', 'mob/piglin/hurt3'], death: ['mob/piglin/death1', 'mob/piglin/death2', 'mob/piglin/death3'] },
    ravager: { ambient: ['mob/ravager/idle1', 'mob/ravager/idle2', 'mob/ravager/idle3', 'mob/ravager/idle4'], hurt: ['mob/ravager/hurt1', 'mob/ravager/hurt2', 'mob/ravager/hurt3'], death: ['mob/ravager/death1', 'mob/ravager/death2', 'mob/ravager/death3'] },
    vex: { ambient: ['mob/vex/idle1', 'mob/vex/idle2', 'mob/vex/idle3', 'mob/vex/idle4'], hurt: ['mob/vex/hurt1', 'mob/vex/hurt2'], death: ['mob/vex/death1', 'mob/vex/death2'] },
    illusioner: { ambient: ['mob/illusion_illager/idle1', 'mob/illusion_illager/idle2', 'mob/illusion_illager/idle3', 'mob/illusion_illager/idle4'], hurt: ['mob/illusion_illager/hurt1', 'mob/illusion_illager/hurt2', 'mob/illusion_illager/hurt3'], death: ['mob/illusion_illager/death1', 'mob/illusion_illager/death2'] },
    evoker: { ambient: ['mob/evocation_illager/idle1', 'mob/evocation_illager/idle2', 'mob/evocation_illager/idle3', 'mob/evocation_illager/idle4'], hurt: ['mob/evocation_illager/hurt1', 'mob/evocation_illager/hurt2'], death: ['mob/evocation_illager/death1', 'mob/evocation_illager/death2'] },
    vindicator: { ambient: ['mob/vindication_illager/idle1', 'mob/vindication_illager/idle2', 'mob/vindication_illager/idle3', 'mob/vindication_illager/idle4'], hurt: ['mob/vindication_illager/hurt1', 'mob/vindication_illager/hurt2', 'mob/vindication_illager/hurt3'], death: ['mob/vindication_illager/death1', 'mob/vindication_illager/death2'] }
  });
});
