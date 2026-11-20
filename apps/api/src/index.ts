import { createApp } from './app.ts'
import { demoDirectory, prepareDataDirectory, prepareProductionDirectory } from './data-paths.ts'
import { LOCAL_WARDROBE_ID, openDatabase } from './db.ts'

const production = process.argv[2] === 'production'
const { NODE_ENV, WEARLY_DATA_DIR, WEARLY_PUBLIC_ORIGIN, WEARLY_CUTOUT_URL } = process.env
if (production && NODE_ENV !== 'production') {
  throw new Error('Production start requires NODE_ENV=production')
}
if (!production && (NODE_ENV === 'production' || WEARLY_DATA_DIR || WEARLY_PUBLIC_ORIGIN)) {
  throw new Error('Use npm start with production configuration. The development API requires local data.')
}

const publicOrigin = production ? URL.parse(WEARLY_PUBLIC_ORIGIN ?? '') : null
if (production && (!publicOrigin || publicOrigin.protocol !== 'https:' ||
  (WEARLY_PUBLIC_ORIGIN !== publicOrigin.origin && WEARLY_PUBLIC_ORIGIN !== `${publicOrigin.origin}/`))) {
  throw new Error('WEARLY_PUBLIC_ORIGIN must be an HTTPS origin, for example https://wearly.example.com')
}
const port = process.env.PORT ?? '3000'
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}
const host = process.env.WEARLY_BIND_HOST ?? '127.0.0.1'
if (host !== '127.0.0.1' && !(production && host === '0.0.0.0')) {
  throw new Error('WEARLY_BIND_HOST must be 127.0.0.1, or 0.0.0.0 on a private production network')
}
const cutoutUrl = WEARLY_CUTOUT_URL ? URL.parse(WEARLY_CUTOUT_URL) : null
if (WEARLY_CUTOUT_URL && (!cutoutUrl || !['http:', 'https:'].includes(cutoutUrl.protocol) ||
  cutoutUrl.username || cutoutUrl.password || cutoutUrl.hash)) {
  throw new Error('WEARLY_CUTOUT_URL must be the HTTP(S) cutout endpoint, for example http://127.0.0.1:7000/cutout')
}

const { database, photos } = production
  ? prepareProductionDirectory(WEARLY_DATA_DIR)
  : prepareDataDirectory(demoDirectory)
const db = openDatabase(database, production ? 'production' : 'demo')
if (production) db.prepare('INSERT OR IGNORE INTO wardrobes (id) VALUES (?)').run(LOCAL_WARDROBE_ID)

const server = createApp(db, photos, publicOrigin, cutoutUrl).listen(Number(port), host, () => {
  console.log(`Wearly API listening on http://${host}:${Number(port)}`)
})
process.once('SIGTERM', () => server.close())
