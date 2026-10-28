// Installe kando.happ dans le conducteur en cours, a cote de hREA.
import { AdminWebsocket } from '@holochain/client'

const ADMIN_URL = process.env.HREA_ADMIN_URL || 'ws://127.0.0.1:4444'
const APP_ID = process.env.KANDO_APP_ID || 'kando'
const HAPP_PATH = process.env.KANDO_HAPP_PATH || '/data/kando.happ' // chemin cote conducteur
const wsClientOptions = { origin: process.env.HREA_ORIGIN || 'http://localhost' }

const admin = await AdminWebsocket.connect({ url: new URL(ADMIN_URL), wsClientOptions })

const before = await admin.listApps({})
console.log('[install] apps avant:', before.map(a => a.installed_app_id))

if (before.some(a => a.installed_app_id === APP_ID)) {
  console.log(`[install] '${APP_ID}' deja installe, on saute l'installation`)
} else {
  const agent_key = await admin.generateAgentPubKey()
  console.log('[install] cle agent generee')
  const info = await admin.installApp({
    installed_app_id: APP_ID,
    agent_key,
    source: { type: 'path', value: HAPP_PATH },
    network_seed: process.env.KANDO_SEED || 'hello-holo-demo',
  })
  console.log('[install] installe:', info.installed_app_id)
  await admin.enableApp({ installed_app_id: APP_ID })
  console.log('[install] active')
}

// S'assurer qu'une interface app ecoute sur 4445 (partagee avec hREA).
try {
  const ifaces = await admin.listAppInterfaces()
  console.log('[install] interfaces app:', JSON.stringify(ifaces))
} catch (e) { console.log('[install] listAppInterfaces indisponible:', e.message) }

const after = await admin.listApps({})
console.log('[install] apps apres:', after.map(a => `${a.installed_app_id}[${a.status?.type||a.status}]`))
await admin.client.close()
console.log('[install] termine.')
