// تشفير رموز الدخول — بدل تخزينها كنص صريح في قاعدة البيانات (localStorage/Supabase)
// حيث يستطيع أي شخص يفتح أدوات المطوّر قراءتها مباشرة.
// كل مستخدم له salt عشوائي خاص + hash = SHA-256(salt + password)، عبر Web Crypto API.

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function genSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufToHex(bytes);
}

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}

export async function verifyPassword(password, salt, hash) {
  const computed = await hashPassword(password, salt);
  return computed === hash;
}
