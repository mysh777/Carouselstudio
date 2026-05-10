// Minimal ZIP writer (STORE, no compression) with UTF-8 file names.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(v: Uint8Array, n: number, off: number): number {
  v[off] = n & 0xff;
  v[off + 1] = (n >>> 8) & 0xff;
  return off + 2;
}

function u32(v: Uint8Array, n: number, off: number): number {
  v[off] = n & 0xff;
  v[off + 1] = (n >>> 8) & 0xff;
  v[off + 2] = (n >>> 16) & 0xff;
  v[off + 3] = (n >>> 24) & 0xff;
  return off + 4;
}

export type ZipEntry = { name: string; data: Uint8Array };

const UTF8_FLAG = 0x0800;

export function buildZip(entries: ZipEntry[]): Blob {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = new Uint8Array(30 + nameBytes.length + size);
    let p = 0;
    p = u32(local, 0x04034b50, p);
    p = u16(local, 20, p);
    p = u16(local, UTF8_FLAG, p);
    p = u16(local, 0, p);
    p = u16(local, 0, p);
    p = u16(local, 0, p);
    p = u32(local, crc, p);
    p = u32(local, size, p);
    p = u32(local, size, p);
    p = u16(local, nameBytes.length, p);
    p = u16(local, 0, p);
    local.set(nameBytes, p);
    p += nameBytes.length;
    local.set(e.data, p);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    let q = 0;
    q = u32(central, 0x02014b50, q);
    q = u16(central, 20, q);
    q = u16(central, 20, q);
    q = u16(central, UTF8_FLAG, q);
    q = u16(central, 0, q);
    q = u16(central, 0, q);
    q = u16(central, 0, q);
    q = u32(central, crc, q);
    q = u32(central, size, q);
    q = u32(central, size, q);
    q = u16(central, nameBytes.length, q);
    q = u16(central, 0, q);
    q = u16(central, 0, q);
    q = u16(central, 0, q);
    q = u16(central, 0, q);
    q = u32(central, 0, q);
    q = u32(central, offset, q);
    central.set(nameBytes, q);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  let r = 0;
  r = u32(end, 0x06054b50, r);
  r = u16(end, 0, r);
  r = u16(end, 0, r);
  r = u16(end, entries.length, r);
  r = u16(end, entries.length, r);
  r = u32(end, centralSize, r);
  r = u32(end, offset, r);
  r = u16(end, 0, r);

  return new Blob([...locals, ...centrals, end], { type: 'application/zip' });
}
