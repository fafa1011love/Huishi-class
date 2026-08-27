import type { ModelType } from '../types';

const DATABASE_NAME = 'huishi-local-model-library';
const DATABASE_VERSION = 3;
const STORE_NAME = 'models';
const HIDDEN_STATIC_MODELS_STORE_NAME = 'hidden-static-models';

export interface LocalModelAsset {
  name: string;
  blob: Blob;
}

export interface LocalModelSummary {
  id: string;
  ownerId: number;
  name: string;
  type: ModelType;
  size: number;
  createdAt: number;
}

export interface LocalModelRecord extends LocalModelSummary {
  blob: Blob;
  assets?: LocalModelAsset[];
}

interface HiddenStaticModelRecord {
  id: string;
  ownerId: number;
  modelId: string;
  hiddenAt: number;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ownerId', 'ownerId', { unique: false });
      } else {
        const store = request.transaction?.objectStore(STORE_NAME);
        if (store && !store.indexNames.contains('ownerId')) {
          store.createIndex('ownerId', 'ownerId', { unique: false });
        }
      }

      if (!database.objectStoreNames.contains(HIDDEN_STATIC_MODELS_STORE_NAME)) {
        const hiddenStore = database.createObjectStore(HIDDEN_STATIC_MODELS_STORE_NAME, { keyPath: 'id' });
        hiddenStore.createIndex('ownerId', 'ownerId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开浏览器本地模型库'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('浏览器本地模型库操作失败'));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('浏览器本地模型库操作失败'));
    transaction.onabort = () => reject(transaction.error || new Error('浏览器本地模型库操作失败'));
  });
}

async function putLocalModel(record: LocalModelRecord) {
  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionComplete(transaction);
    return record;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('浏览器本地存储空间不足，请清理站点数据后重试');
    }
    throw error;
  } finally {
    database?.close();
  }
}

export async function saveGeneratedModel(input: {
  id: string;
  ownerId: number;
  name: string;
  url: string;
}) {
  const response = await fetch(input.url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`模型下载失败（${response.status}）`);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('下载到的模型文件为空');

  const record: LocalModelRecord = {
    id: `${input.ownerId}:${input.id}`,
    ownerId: input.ownerId,
    name: input.name,
    type: 'glb',
    size: blob.size,
    createdAt: Date.now(),
    blob,
    assets: [],
  };

  return putLocalModel(record);
}

export async function saveUploadedModel(input: {
  ownerId: number;
  files: File[];
}) {
  const modelFiles = input.files.filter((file) => /\.(glb|gltf|fbx)$/i.test(file.name));
  if (modelFiles.length > 1) throw new Error('一次只能导入一个主模型，其余文件应为纹理或二进制附件');
  const modelFile = modelFiles[0];
  if (!modelFile) throw new Error('请选择 GLB、GLTF 或 FBX 模型文件');

  const lowerName = modelFile.name.toLowerCase();
  const type: ModelType = lowerName.endsWith('.fbx')
    ? 'fbx'
    : lowerName.endsWith('.gltf')
      ? 'gltf'
      : 'glb';
  const duplicateNames = new Set<string>();
  input.files.forEach((file) => {
    const key = file.name.toLowerCase();
    if (duplicateNames.has(key)) throw new Error(`存在同名模型附件：${file.name}`);
    duplicateNames.add(key);
  });

  const idPart = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record: LocalModelRecord = {
    id: `${input.ownerId}:upload:${idPart}`,
    ownerId: input.ownerId,
    name: modelFile.name,
    type,
    size: input.files.reduce((total, file) => total + file.size, 0),
    createdAt: Date.now(),
    blob: modelFile,
    assets: input.files
      .filter((file) => file !== modelFile)
      .map((file) => ({ name: file.name, blob: file })),
  };

  return putLocalModel(record);
}

export async function listLocalModels(ownerId: number) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const records = await requestResult(
    transaction.objectStore(STORE_NAME).index('ownerId').getAll(ownerId),
  ) as LocalModelRecord[];
  database.close();

  return records
    .map((record): LocalModelSummary => ({
      id: record.id,
      ownerId: record.ownerId,
      name: record.name,
      type: record.type,
      size: record.size,
      createdAt: record.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLocalModel(id: string, ownerId: number) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const record = await requestResult(
    transaction.objectStore(STORE_NAME).get(id),
  ) as LocalModelRecord | undefined;
  database.close();

  return record?.ownerId === ownerId ? { ...record, assets: record.assets || [] } : null;
}

export async function deleteLocalModel(id: string, ownerId: number) {
  const database = await openDatabase();

  // First, verify the owner
  const getTransaction = database.transaction(STORE_NAME, 'readonly');
  const record = await requestResult(
    getTransaction.objectStore(STORE_NAME).get(id),
  ) as LocalModelRecord | undefined;

  if (record && record.ownerId === ownerId) {
    const deleteTransaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(deleteTransaction.objectStore(STORE_NAME).delete(id));
  }

  database.close();
}

export async function listHiddenStaticModelIds(ownerId: number) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HIDDEN_STATIC_MODELS_STORE_NAME, 'readonly');
    const records = await requestResult(
      transaction.objectStore(HIDDEN_STATIC_MODELS_STORE_NAME).index('ownerId').getAll(ownerId),
    ) as HiddenStaticModelRecord[];
    return records.map((record) => record.modelId);
  } finally {
    database.close();
  }
}

export async function hideStaticModel(modelId: string, ownerId: number) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HIDDEN_STATIC_MODELS_STORE_NAME, 'readwrite');
    transaction.objectStore(HIDDEN_STATIC_MODELS_STORE_NAME).put({
      id: `${ownerId}:${modelId}`,
      ownerId,
      modelId,
      hiddenAt: Date.now(),
    } satisfies HiddenStaticModelRecord);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}
