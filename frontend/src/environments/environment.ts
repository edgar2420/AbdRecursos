const API_PORT = 3000;

function resolveApiUrl(): string {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${API_PORT}/api/v1`;
}

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(),
};
