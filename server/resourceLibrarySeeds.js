export const ORGAN_RESOURCE_MODELS = Object.freeze([
  { seedKey: 'bio-organ-heart', name: '心脏（解剖）', url: '/models/organ-heart.glb', sortOrder: 20 },
  { seedKey: 'bio-organ-brain', name: '大脑', url: '/models/organ-brain.glb', sortOrder: 30 },
  { seedKey: 'bio-organ-lungs', name: '肺', url: '/models/organ-lungs.glb', sortOrder: 40 },
  { seedKey: 'bio-organ-liver', name: '肝脏', url: '/models/organ-liver.glb', sortOrder: 50 },
  { seedKey: 'bio-organ-kidneys', name: '肾脏', url: '/models/organ-kidneys.glb', sortOrder: 60 },
  { seedKey: 'bio-organ-eyeball', name: '眼球', url: '/models/organ-eyeball.glb', sortOrder: 70 },
  { seedKey: 'bio-organ-intestine', name: '肠', url: '/models/organ-intestine.glb', sortOrder: 80 },
  { seedKey: 'bio-organ-pancreas', name: '胰腺', url: '/models/organ-pancreas.glb', sortOrder: 90 },
  { seedKey: 'bio-organ-skin', name: '皮肤', url: '/models/organ-skin.glb', sortOrder: 100 },
]);

export async function applyOrganResourceSeed(connection) {
  await connection.execute(
    `INSERT INTO resource_tags (name, icon_key, sort_order)
     VALUES ('生物', 'heart', 20)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
  );
  const [bioTags] = await connection.execute(
    'SELECT id FROM resource_tags WHERE name = "生物" LIMIT 1',
  );
  const bioTagId = Number(bioTags[0].id);

  for (const model of ORGAN_RESOURCE_MODELS) {
    await connection.execute(
      `INSERT INTO resource_models
        (tag_id, name, model_type, source_kind, source_url, seed_key, sort_order)
       VALUES (:tagId, :name, 'glb', 'builtin', :url, :seedKey, :sortOrder)
       ON DUPLICATE KEY UPDATE
         tag_id = VALUES(tag_id),
         name = VALUES(name),
         model_type = VALUES(model_type),
         source_kind = VALUES(source_kind),
         source_url = VALUES(source_url),
         sort_order = VALUES(sort_order)`,
      { ...model, tagId: bioTagId },
    );
  }

  await connection.execute(
    'UPDATE resource_models SET sort_order = 110 WHERE seed_key = "bio-hiv"',
  );
  await connection.execute(
    'INSERT IGNORE INTO app_metadata (meta_key, meta_value) VALUES ("resource_library_seed_v2_organs", "1")',
  );
}
