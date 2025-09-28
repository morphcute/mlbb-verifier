const DEFAULT_HOST = 'id-game-checker.p.rapidapi.com';

export type CheckResult = {
  ok: boolean;
  username: string;
  mapping: 'E→D' | 'D→E' | '';
  raw?: string;
  status?: number;
};

async function checkOnce(rapidKey: string, host: string, id: string, server: string) {
  const url = `https://${host}/mobile-legends/${encodeURIComponent(id)}/${encodeURIComponent(server)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': host,
      'x-rapidapi-key': rapidKey
    }
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}
  const ok = res.ok && data && data.error === false && data.msg === 'id_found';
  const username = ok && data?.data?.username ? String(data.data.username) : '';
  return { ok, username, raw: text, status: res.status };
}

/** Mirrors your fetchUsernameTryBoth_ logic */
export async function checkUser(rapidKey: string, id: string, server: string, host = DEFAULT_HOST): Promise<CheckResult> {
  const r1 = await checkOnce(rapidKey, host, String(id).trim(), String(server).trim());
  if (r1.ok) return { ok: true, username: r1.username, mapping: 'E→D', raw: r1.raw, status: r1.status };

  const r2 = await checkOnce(rapidKey, host, String(server).trim(), String(id).trim());
  if (r2.ok) return { ok: true, username: r2.username, mapping: 'D→E', raw: r2.raw, status: r2.status };

  return { ok: false, username: '', mapping: '', raw: r1.raw, status: r1.status };
}

/** Quick ping to validate a user-provided RapidAPI key */
export async function validateRapidKey(rapidKey: string, host = DEFAULT_HOST): Promise<boolean> {
  try {
    const res = await fetch(`https://${host}/mobile-legends/test/test`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': host,
        'x-rapidapi-key': rapidKey
      }
    });
    if (res.status === 401 || res.status === 403) return false;
    return true;
  } catch {
    return false;
  }
}
