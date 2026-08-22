function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function imageIdFor(entryId, contentBase64) {
  const prefix = new TextEncoder().encode(entryId);
  const content = base64ToBytes(contentBase64);
  const input = new Uint8Array(prefix.length + content.length);
  input.set(prefix);
  input.set(content, prefix.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
