const MODEL_COS_BASE_URL = String(import.meta.env.VITE_MODEL_COS_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function resolveModelAssetUrl(url: string) {
  if (!MODEL_COS_BASE_URL || !url.startsWith('/models/')) return url;
  return `${MODEL_COS_BASE_URL}/${url.slice('/models/'.length)}`;
}
