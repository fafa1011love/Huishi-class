import type { ConversationSession, LearningMemory, MemorySettings } from '../types';

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || '学习记忆请求失败');
  return data as T;
}

export async function openLearningSession(): Promise<{ session: ConversationSession | null; settings: MemorySettings }> {
  const response = await fetch('/api/memory/sessions', { method: 'POST', credentials: 'include' });
  return readJson(response);
}

export async function appendLearningMessage(
  sessionId: number,
  role: 'user' | 'assistant' | 'event',
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const response = await fetch(`/api/memory/sessions/${sessionId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content, metadata }),
  });
  if (!response.ok && response.status !== 409) await readJson(response);
}

export async function listLearningMemories(): Promise<LearningMemory[]> {
  const response = await fetch('/api/memory/memories', { credentials: 'include' });
  const data = await readJson<{ memories: LearningMemory[] }>(response);
  return data.memories;
}

export async function updateLearningMemory(id: number, content: string): Promise<LearningMemory> {
  const response = await fetch(`/api/memory/memories/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await readJson<{ memory: LearningMemory }>(response);
  return data.memory;
}

export async function deleteLearningMemory(id: number): Promise<void> {
  const response = await fetch(`/api/memory/memories/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!response.ok) await readJson(response);
}

export async function clearLearningMemories(): Promise<void> {
  const response = await fetch('/api/memory/memories', { method: 'DELETE', credentials: 'include' });
  if (!response.ok) await readJson(response);
}

export async function updateMemorySettings(settings: Partial<MemorySettings>): Promise<MemorySettings> {
  const response = await fetch('/api/memory/settings', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await readJson<{ settings: MemorySettings }>(response);
  return data.settings;
}
