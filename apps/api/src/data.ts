import { resolve } from 'node:path'
import { demoDirectory, prepareProductionDirectory } from './data-paths.ts'
import { openDatabase } from './db.ts'
import { seedDemo } from './seed.ts'
import { backup, restore } from './snapshots.ts'

const [command, ...args] = process.argv.slice(2)
const path = (value: string) => resolve(process.env.INIT_CWD ?? process.cwd(), value)

switch (command) {
  case 'seed': {
    if (args.length > 1) throw new Error('Usage: npm run seed -- [demo-directory]')
    if (process.env.NODE_ENV === 'production' || process.env.WEARLY_DATA_DIR) {
      throw new Error('Demo seed is unavailable when production is configured')
    }
    const directory = args.length ? path(args[0]) : demoDirectory
    console.log(seedDemo(directory) ? `Imported demo data into ${directory}` : `Demo data already imported: ${directory}`)
    break
  }
  case 'backup':
    if (args.length !== 2) throw new Error('Usage: npm run backup -- <data-directory> <new-snapshot-directory>')
    backup(path(args[0]), path(args[1]))
    console.log(`Snapshot created: ${path(args[1])}`)
    break
  case 'restore':
    if (args.length !== 2) throw new Error('Usage: npm run restore -- <snapshot-directory> <new-data-directory>')
    restore(path(args[0]), path(args[1]))
    console.log(`Snapshot restored: ${path(args[1])}`)
    break
  case 'migrate': {
    if (args.length) throw new Error('Usage: WEARLY_DATA_DIR=/absolute/path npm run migrate')
    const { database } = prepareProductionDirectory(process.env.WEARLY_DATA_DIR)
    openDatabase(database, 'production').close()
    console.log(`Production migrations applied: ${database}`)
    break
  }
  default:
    throw new Error('Expected seed, backup, restore or migrate')
}
