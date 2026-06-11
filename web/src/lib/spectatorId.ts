const ID_KEY = 'racingshape-spectator-id';
const NAME_KEY = 'racingshape-spectator-name';
const FLAG_KEY = 'racingshape-spectator-flag';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* ignore quota/permission */ }
}

export function getSessionId(): string {
  let id = read(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(ID_KEY, id);
  }
  return id;
}

export interface SpectatorIdentity { name: string | null; flag: string | null; }

export function getIdentity(): SpectatorIdentity {
  return { name: read(NAME_KEY), flag: read(FLAG_KEY) };
}
export function setName(name: string | null): void { write(NAME_KEY, name && name.trim() ? name.trim() : null); }
export function setFlag(flag: string | null): void { write(FLAG_KEY, flag); }
