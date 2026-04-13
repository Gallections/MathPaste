import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distPath = path.join(root, 'dist')
const outputPath = path.join(root, 'mathpaste.zip')

if (!fs.existsSync(distPath)) {
  console.error('dist/ not found. Run npm run build first.')
  process.exit(1)
}

if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath)
}

const output = fs.createWriteStream(outputPath)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`mathpaste.zip created (${(archive.pointer() / 1024).toFixed(1)} KB)`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)
archive.directory(distPath, false)
archive.finalize()
