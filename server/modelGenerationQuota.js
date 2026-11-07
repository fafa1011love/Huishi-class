export const FREE_MODEL_GENERATION_LIMIT = 3;

export function createModelGenerationQuota(pool) {
  async function ensure(userId, executor = pool) {
    await executor.execute(
      'INSERT IGNORE INTO user_model_generation_quotas (user_id) VALUES (:userId)',
      { userId },
    );
  }

  async function read(userId, executor = pool) {
    await ensure(userId, executor);
    const [rows] = await executor.execute(
      'SELECT total, used FROM user_model_generation_quotas WHERE user_id = :userId LIMIT 1',
      { userId },
    );
    const total = Number(rows[0]?.total ?? FREE_MODEL_GENERATION_LIMIT);
    const used = Number(rows[0]?.used ?? 0);
    return { total, used, remaining: Math.max(0, total - used) };
  }

  async function consume(userId, executor = pool) {
    await ensure(userId, executor);
    const [result] = await executor.execute(
      'UPDATE user_model_generation_quotas SET used = used + 1 WHERE user_id = :userId AND used < total',
      { userId },
    );
    if (result.affectedRows !== 1) return null;
    return read(userId, executor);
  }

  async function refund(userId, executor = pool) {
    await executor.execute(
      'UPDATE user_model_generation_quotas SET used = GREATEST(used - 1, 0) WHERE user_id = :userId',
      { userId },
    );
  }

  return { read, consume, refund };
}
