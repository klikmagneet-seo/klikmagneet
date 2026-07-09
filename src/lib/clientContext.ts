const CLIENT_KEY = 'klikmagneet_client_id';

export function getSelectedClientId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CLIENT_KEY);
}

export function setSelectedClientId(id: string): void {
  localStorage.setItem(CLIENT_KEY, id);
}

export function clearSelectedClientId(): void {
  localStorage.removeItem(CLIENT_KEY);
}
