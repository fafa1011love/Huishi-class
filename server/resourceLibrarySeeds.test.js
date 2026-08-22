import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOrganResourceSeed, ORGAN_RESOURCE_MODELS } from './resourceLibrarySeeds.js';

class SeedDatabaseDouble {
  models = new Map([['bio-hiv', { seedKey: 'bio-hiv', sortOrder: 20 }]]);
  metadata = new Set(['resource_library_seed_v1']);

  async execute(sql, params = {}) {
    if (sql.includes('SELECT id FROM resource_tags')) return [[{ id: 2 }]];
    if (sql.includes('INSERT INTO resource_models')) {
      this.models.set(params.seedKey, { ...params });
    } else if (sql.includes('UPDATE resource_models')) {
      this.models.get('bio-hiv').sortOrder = 110;
    } else if (sql.includes('INSERT IGNORE INTO app_metadata')) {
      this.metadata.add('resource_library_seed_v2_organs');
    }
    return [[], []];
  }
}

test('v1 资源库执行 v2 后新增器官、后续执行保持幂等', async () => {
  const database = new SeedDatabaseDouble();

  await applyOrganResourceSeed(database);
  await applyOrganResourceSeed(database);

  assert.equal(ORGAN_RESOURCE_MODELS.length, 9);
  assert.equal(database.models.size, 10);
  assert.equal(database.models.get('bio-hiv').sortOrder, 110);
  assert.ok(database.metadata.has('resource_library_seed_v1'));
  assert.ok(database.metadata.has('resource_library_seed_v2_organs'));
  assert.deepEqual(
    ORGAN_RESOURCE_MODELS.map((model) => model.name),
    ['心脏（解剖）', '大脑', '肺', '肝脏', '肾脏', '眼球', '肠', '胰腺', '皮肤'],
  );
});
