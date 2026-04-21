import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Avoid Next.js picking up /Users/<user>/package-lock.json as workspace root
  // when multiple lockfiles exist above the project.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
