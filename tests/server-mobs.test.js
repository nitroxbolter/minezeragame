'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMobAuthority, TerrainSampler } = require('../server-mobs');

const catalog = [
  { id: 'pig', health: 10, damage: 0, speed: 1.6, element: 'Nenhum' },
  { id: 'sheep', health: 8, damage: 0, speed: 1.5, element: 'Nenhum' },
  { id: 'zombie', health: 20, damage: 3, speed: 2.4, element: 'Nenhum' }
];

function fixture(config = {}) {
  const broadcasts = [], sends = [];
  const client = { id: 'player-1', state: { x: 0, y: 70, z: 0, dead: false, mode: 'survival' }, ws: {} };
  const authority = createMobAuthority({
    catalog,
    getPlayers: () => [client].values(),
    broadcast: (message) => broadcasts.push(message),
    send: (ws, message) => sends.push(message),
    config
  });
  return { authority, client, broadcasts, sends };
}

test('terrain sampler is deterministic and stays inside world height', () => {
  const terrain = new TerrainSampler();
  const first = terrain.sample(20, -75);
  const second = terrain.sample(20, -75);
  assert.deepEqual(first, second);
  assert.ok(first.h >= 4 && first.h <= 122);
});

test('server assigns unique ids and publishes authoritative spawns', () => {
  const { authority, broadcasts, sends } = fixture();
  const a = authority.spawn('pig', 1, 70, 1);
  const b = authority.spawn('pig', 2, 70, 2);
  assert.notEqual(a.id, b.id);
  assert.equal(authority.snapshot().length, 2);
  assert.equal(broadcasts.filter((message) => message.type === 'mob_spawn').length, 0);
  assert.equal(sends.filter((message) => message.type === 'mob_spawn').length, 2);
});

test('hard global cap blocks every spawn source above the configured maximum', () => {
  const { authority } = fixture({ hardGlobalCap: 2 });
  assert.ok(authority.spawn('pig', 1, 70, 1, 'natural'));
  assert.ok(authority.spawn('zombie', 2, 70, 2, 'command'));
  assert.equal(authority.spawn('sheep', 3, 70, 3, 'village'), null);
  assert.equal(authority.snapshot().length, 2);
});

test('server validates distance, applies damage and owns mob death', () => {
  const { authority, client, broadcasts } = fixture();
  const mob = authority.spawn('zombie', 1, 70, 1);
  assert.equal(authority.handleHit(client, { mobId: mob.id, amount: 30 }), true);
  assert.equal(authority.snapshot().length, 0);
  assert.ok(broadcasts.some((message) => message.type === 'mob_remove' && message.killerId === client.id));

  const farMob = authority.spawn('zombie', 100, 70, 100);
  assert.equal(authority.handleHit(client, { mobId: farMob.id, amount: 30 }), false);
  assert.equal(authority.snapshot().length, 1);
});

test('shearing is accepted once and result is sent only to the actor', () => {
  const { authority, client, sends } = fixture();
  const sheep = authority.spawn('sheep', 1, 70, 1);
  assert.equal(authority.handleAction(client, { mobId: sheep.id, action: 'shear' }), true);
  assert.equal(authority.handleAction(client, { mobId: sheep.id, action: 'shear' }), false);
  const result = sends.filter((message) => message.type === 'mob_action_result');
  assert.equal(result.length, 1);
});
