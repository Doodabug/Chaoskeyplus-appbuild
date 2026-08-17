// Client-side encrypted vault using Web Crypto API.
// Passphrase → PBKDF2-SHA256(100k iters) → AES-GCM-256 key → encrypt JSON blob.
// Stored in localStorage under 'chaoskey.vault.v1'.

const STORAGE_KEY = "chaoskey.vault.v1";
const ITER = 100_000;
const KEY_LEN = 256;

function b64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function deriveKey(passphrase, saltU8) {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltU8, iterations: ITER, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: KEY_LEN },
    false,
    ["encrypt", "decrypt"]
  );
}

export function vaultExists() {
  return !!localStorage.getItem(STORAGE_KEY);
}

export function clearVault() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function saveVault(passphrase, items) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const pt = enc.encode(JSON.stringify(items));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  const blob = { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

export async function loadVault(passphrase) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const blob = JSON.parse(raw);
  const salt = unb64(blob.salt);
  const iv = unb64(blob.iv);
  const ct = unb64(blob.ct);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}
