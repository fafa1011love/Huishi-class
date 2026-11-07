import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelGenerationQuota } from './modelGenerationQuota.js';

function createQuotaPool() {
  const rows = new Map();
  return {
    rows,
    async execute(sql, { userId }) {
      if (sql.startsWith('INSERT IGNORE')) {
        if (!rows.has(userId)) rows.set(userId, { total: 3, used: 0 });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('SELECT total, used')) return [[{ ...rows.get(userId) }]];
      if (sql.startsWith('UPDATE') && sql.includes('GREATEST')) {
        const row = rows.get(userId);
        row.used = Math.max(0, row.used - 1);
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE')) {
        const row = rows.get(userId);
        if (row.used >= row.total) return [{ affectedRows: 0 }];
        row.used += 1;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

test('initializes new and existing users with three post-launch uses', async () => {
  const pool = createQuotaPool();
  const quota = createModelGenerationQuota(pool);
  assert.deepEqual(await quota.read(10), { total: 3, used: 0, remaining: 3 });
  pool.rows.set(11, { total: 3, used: 0 });
  assert.deepEqual(await quota.read(11), { total: 3, used: 0, remaining: 3 });
});

test('consumes atomically to zero and refuses extra uses', async () => {
  const quota = createModelGenerationQuota(createQuotaPool());
  assert.deepEqual(await quota.consume(10), { total: 3, used: 1, remaining: 2 });
  await quota.consume(10);
  assert.deepEqual(await quota.consume(10), { total: 3, used: 3, remaining: 0 });
  assert.equal(await quota.consume(10), null);
});

test('concurrent submissions cannot exceed the available uses', async () => {
  const quota = createModelGenerationQuota(createQuotaPool());
  const results = await Promise.all(Array.from({ length: 8 }, () => quota.consume(10)));
  assert.equal(results.filter(Boolean).length, 3);
  assert.deepEqual(await quota.read(10), { total: 3, used: 3, remaining: 0 });
});

test('refunds a rejected request without going below zero', async () => {
  const quota = createModelGenerationQuota(createQuotaPool());
  await quota.consume(10);
  await quota.refund(10);
  assert.deepEqual(await quota.read(10), { total: 3, used: 0, remaining: 3 });
  await quota.consume(10);
  await quota.refund(10);
  assert.deepEqual(await quota.read(10), { total: 3, used: 0, remaining: 3 });
});
