// Extrait le .happ (backend) contenu dans un .webhapp.
// Placé dans client/ pour que Node résolve @msgpack/msgpack via client/node_modules.
// Usage: node client/extract-happ.mjs <in.webhapp> <out.happ>
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { decode } from '@msgpack/msgpack'

const [, , inp, out] = process.argv
const b = decode(gunzipSync(readFileSync(inp)))
const p = b.manifest?.happ?.path
if (!p || !b.resources?.[p]) throw new Error('happ introuvable dans le webhapp (clés: ' + Object.keys(b.resources || {}) + ')')
const r = b.resources[p]
writeFileSync(out, Buffer.from(r.buffer, r.byteOffset, r.byteLength))
console.log(`extrait ${p} -> ${out} (${r.length} o)`)
