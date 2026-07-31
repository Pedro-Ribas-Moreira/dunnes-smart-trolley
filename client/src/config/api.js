const rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || '';

export const API_BASE_URL =
  rawApiBaseUrl.replace(/\/$/, '');

export function createApiUrl(path) {
  const normalizedPath =
    path.startsWith('/')
      ? path
      : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}