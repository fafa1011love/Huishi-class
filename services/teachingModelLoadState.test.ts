import assert from 'node:assert/strict';
import test from 'node:test';
import type { TeachingModelId } from '../types.ts';
import { decideTeachingModelLoad, isCurrentModelLoadEvent, TeachingModelLoadError } from './teachingModelLoadState.ts';

const HEART_URL = '/models/heart-optimized.glb';
const BRAIN_URL = '/models/organ-brain.glb';

const baseSnapshot = {
  targetModelId: 'heart' as const,
  targetModelUrl: HEART_URL,
  activeContent: 'model' as const,
  activeModelId: null,
  activeModelUrl: null,
  loadedModelUrl: null,
  failedModelUrl: null,
};

test('starts a load when the requested built-in model is not active', () => {
  assert.equal(decideTeachingModelLoad(baseSnapshot), 'start');
});

test('returns immediately only when the active model has completed loading', () => {
  assert.equal(decideTeachingModelLoad({
    ...baseSnapshot,
    activeModelId: 'heart',
    activeModelUrl: HEART_URL,
    loadedModelUrl: HEART_URL,
  }), 'ready');
});

test('waits for the current viewer when the URL is active but has not completed', () => {
  assert.equal(decideTeachingModelLoad({
    ...baseSnapshot,
    activeModelId: 'heart',
    activeModelUrl: HEART_URL,
  }), 'wait');
});

test('reuses a matching pending load promise', () => {
  assert.equal(decideTeachingModelLoad({
    ...baseSnapshot,
    activeModelId: 'heart',
    activeModelUrl: HEART_URL,
    pendingModelId: 'heart',
    pendingModelUrl: HEART_URL,
  }), 'reuse');
});

test('retries an active model after its previous load failed', () => {
  assert.equal(decideTeachingModelLoad({
    ...baseSnapshot,
    activeModelId: 'heart',
    activeModelUrl: HEART_URL,
    failedModelUrl: HEART_URL,
  }), 'retry');
});

test('starts a new load when another model is pending', () => {
  assert.equal(decideTeachingModelLoad({
    ...baseSnapshot,
    activeModelId: 'brain',
    activeModelUrl: BRAIN_URL,
    pendingModelId: 'brain',
    pendingModelUrl: BRAIN_URL,
  }), 'start');
});

test('treats the active BioDigital viewer as ready without a GLB URL', () => {
  assert.equal(decideTeachingModelLoad({
    ...baseSnapshot,
    targetModelId: 'biodigital_heart',
    targetModelUrl: undefined,
    activeContent: 'biodigital',
    activeModelId: 'biodigital_heart',
  }), 'ready');
});

test('uses the same completed and pending behavior for every local built-in model', () => {
  const models: Array<[TeachingModelId, string]> = [
    ['heart', HEART_URL],
    ['hiv', '/models/hiv-virus.glb'],
    ['diamond', '/models/diamond.glb'],
    ['diamond_unit_cell', '/models/diamond-unit-cell_NIH3D.glb'],
    ['pubchem_6233', '/models/pubchem-6233-bas-color-print_NIH3D.glb'],
    ['earth_layers', '/models/earth-layers.glb'],
    ['terrain', '/models/terrain-topography.glb'],
    ['nacl', '/models/nacl-crystal.glb'],
    ['sio2', '/models/sio2-crystal.glb'],
    ['nitrobenzene', '/models/7416-bas-color-print_NIH3D.glb'],
    ['brain', BRAIN_URL],
    ['organ_heart', '/models/organ-heart.glb'],
    ['lungs', '/models/organ-lungs.glb'],
    ['liver', '/models/organ-liver.glb'],
    ['kidneys', '/models/organ-kidneys.glb'],
    ['eyeball', '/models/organ-eyeball.glb'],
    ['intestine', '/models/organ-intestine.glb'],
    ['pancreas', '/models/organ-pancreas.glb'],
    ['skin', '/models/organ-skin.glb'],
  ];

  for (const [modelId, modelUrl] of models) {
    const activeSnapshot = {
      ...baseSnapshot,
      targetModelId: modelId,
      targetModelUrl: modelUrl,
      activeModelId: modelId,
      activeModelUrl: modelUrl,
    };
    assert.equal(decideTeachingModelLoad({ ...activeSnapshot, loadedModelUrl: modelUrl }), 'ready', modelId);
    assert.equal(decideTeachingModelLoad({
      ...activeSnapshot,
      pendingModelId: modelId,
      pendingModelUrl: modelUrl,
    }), 'reuse', modelId);
  }
});

test('ignores stale completion and failure events after switching models', () => {
  assert.equal(isCurrentModelLoadEvent(HEART_URL, BRAIN_URL, 1, 2), false);
  assert.equal(isCurrentModelLoadEvent(BRAIN_URL, BRAIN_URL, 2, 2), true);
  assert.equal(isCurrentModelLoadEvent(HEART_URL, null, 1, 2), false);
  assert.equal(isCurrentModelLoadEvent(HEART_URL, HEART_URL, 1, 2), false);
});

test('model load errors retain the failed model identity', () => {
  const error = new TeachingModelLoadError('heart', HEART_URL, '心脏模型加载超时');
  assert.equal(error.name, 'TeachingModelLoadError');
  assert.equal(error.modelId, 'heart');
  assert.equal(error.modelUrl, HEART_URL);
  assert.match(error.message, /加载超时/);
});
