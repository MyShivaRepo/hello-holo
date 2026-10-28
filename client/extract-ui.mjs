// Extrait l'UI (dist.zip) d'un .webhapp. Usage: node client/extract-ui.mjs <in.webhapp> <out.zip>
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { decode } from '@msgpack/msgpack'
const [, , inp, out] = process.argv
const b = decode(gunzipSync(readFileSync(inp)))
const p = b.manifest?.ui?.path
if (!p || !b.resources?.[p]) throw new Error('ui introuvable (clés: ' + Object.keys(b.resources || {}) + ')')
const r = b.resources[p]
writeFileSync(out, Buffer.from(r.buffer, r.byteOffset, r.byteLength))
console.log(`ui ${p} -> ${out} (${r.length} o)`)
