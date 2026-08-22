import type { ModelType } from '../types';

export type ResourceIconKey = 'box' | 'flask' | 'heart' | 'globe' | 'atom';

export interface ResourceModel {
  id: number;
  tagId: number;
  seedKey?: string | null;
  name: string;
  type: ModelType;
  sourceKind: 'builtin' | 'upload';
  url: string;
  assets: Record<string, string>;
  size: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResourceTag {
  id: number;
  name: string;
  iconKey: ResourceIconKey;
  sortOrder: number;
  models: ResourceModel[];
  createdAt?: string;
  updatedAt?: string;
}

async function readError(response: Response) {
  try {
    const data = await response.json();
    return data.message || '资源库请求失败';
  } catch {
    return '资源库请求失败';
  }
}

export async function fetchResourceLibrary() {
  const response = await fetch('/api/resource-library', { credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  return (data.tags || []) as ResourceTag[];
}
