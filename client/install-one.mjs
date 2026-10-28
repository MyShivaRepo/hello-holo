// Installe UN hApp (backend) dans le conducteur en cours, via l'API admin.
// Variables: HREA_ADMIN_URL, APP_ID, HAPP_PATH (chemin côté conducteur), SEED (option).
import { AdminWebsocket } from '@holochain/client'

const ADMIN = process.env.HREA_ADMIN_URL || 'ws://127.0.0.1:4444'
const APP_ID = process.env.APP_ID
const HAPP_PATH = process.env.HAPP_PATH
const SEED = process.env.SEED || undefined
if (!APP_ID || !HAPP_PATH) { console.error('APP_ID et HAPP_PATH requis'); process.exit(1) }

const admin = await AdminWebsocket.connect({ url: new URL(ADMIN), wsClientOptions: { origin: 'http://localhost' } })
const apps = await admin.listApps({})
if (apps.some((a) => a.installed_app_id === APP_ID)) {
  console.log(`[skip] ${APP_ID} déjà installé`)
  await admin.client.close(); process.exit(0)
}
try {
  const agent_key = await admin.generateAgentPubKey()
  await admin.installApp({ installed_app_id: APP_ID, agent_key, source: { type: 'path', value: HAPP_PATH }, ...(SEED ? { network_seed: SEED } : {}) })
  await admin.enableApp({ installed_app_id: APP_ID })
  console.log(`[ok] ${APP_ID} installé + activé`)
  await admin.client.close()
} catch (e) {
  console.error(`[FAIL] ${APP_ID}: ${e.message}`)
  process.exit(2)
}
