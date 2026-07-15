const encoder = new TextEncoder();

export async function deriveRecordingKey(passphrase, username) {
  if (!window.isSecureContext || !crypto.subtle) throw new Error("Private recordings need a modern secure browser.");
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(`FemmeVoice private recordings:${username}`), iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptRecording(blob, key, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(aad) }, key, await blob.arrayBuffer());
  return { ciphertext: new Blob([ciphertext], { type: "application/octet-stream" }), iv: Array.from(iv) };
}

export async function decryptRecording(ciphertext, iv, mimeType, key, aad) {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv), additionalData: encoder.encode(aad) }, key, await ciphertext.arrayBuffer());
  return new Blob([plaintext], { type: mimeType });
}
