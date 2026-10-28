import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { decode } from '@msgpack/msgpack'

const inPath = process.argv[2]
const outDir = process.argv[3]
mkdirSync(outDir, { recursive: true })

const bundle = decode(gunzipSync(readFileSync(inPath)))
console.log('MANIFEST:', JSON.stringify(bundle.manifest))
const resKeys = Object.keys(bundle.resources || {})
console.log('RESOURCES:', resKeys.map(k => `${k} (${bundle.resources[k].length}o)`).join(', '))

// UI bundle (zip) : le chemin est dans manifest.ui.bundled
const uiPath = bundle.manifest?.ui?.bundled
if (uiPath && bundle.resources[uiPath]) {
  const b = bundle.resources[uiPath]
  writeFileSync(outDir + '/ui.zip', Buffer.from(b.buffer, b.byteOffset, b.byteLength))
  console.log('WROTE', outDir + '/ui.zip', b.length)
} else {
  console.log('UI introuvable; clefs:', resKeys)
}
