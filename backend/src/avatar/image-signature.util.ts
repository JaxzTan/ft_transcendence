// Magic bytes for the allowed image types: the multipart mimetype is only the
// client's claim, so a mislabelled or truncated upload would otherwise be stored
// and then fail to decode. See docs/avatar-system.md (Failure modes).

// Signature: [byte offset, expected bytes]. WebP needs two checks
// (RIFF....WEBP), and an unknown mime simply has no entry (`if (!checks)` below).
const SIGNATURES: Record<string, Array<[number, number[]]> | undefined> = {
  'image/png': [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  'image/jpeg': [[0, [0xff, 0xd8, 0xff]]],
  'image/gif': [[0, [0x47, 0x49, 0x46, 0x38]]],
  'image/webp': [
    [0, [0x52, 0x49, 0x46, 0x46]],
    [8, [0x57, 0x45, 0x42, 0x50]],
  ],
};

function matches(buffer: Buffer, offset: number, expected: number[]): boolean {
  if (buffer.length < offset + expected.length) return false;
  return expected.every((byte, i) => buffer[offset + i] === byte);
}

// True when the buffer's leading bytes match the declared image type.
export function isImageSignatureValid(buffer: Buffer, contentType: string): boolean {
  const checks = SIGNATURES[contentType];
  if (!checks) return false;
  return checks.every(([offset, expected]) => matches(buffer, offset, expected));
}
