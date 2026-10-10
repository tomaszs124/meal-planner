#!/usr/bin/env node
/**
 * One-off codemod: `blue-*` colour utilities → `brand-*` (the accent scale defined in
 * src/app/globals.css). Keeps variants (hover:, dark:, focus-visible:) and opacity
 * modifiers. Does not touch tag colours stored in the database.
 *
 *   node scripts/rebrand-blue.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry')
const ROOT = join(process.cwd(), 'src')
const PROPS = 'bg|text|border|ring|ring-offset|from|to|via|divide|outline|shadow|accent|fill|stroke|placeholder|decoration'
const re = new RegExp(`(?<![\\w-])((?:[\\w-]+:)*)(${PROPS})-blue-(\\d{2,3})(?![\\w-])`, 'g')

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(p) && !/\.test\.tsx?$/.test(p)) acc.push(p)
  }
  return acc
}

let total = 0
for (const file of walk(ROOT)) {
  const source = readFileSync(file, 'utf8')
  let n = 0
  const out = source.replace(re, (_m, variants, prop, shade) => {
    n += 1
    return `${variants}${prop}-brand-${shade}`
  })
  if (n > 0) {
    total += n
    console.log(`${String(n).padStart(4)}  ${file.replace(process.cwd(), '')}`)
    if (!DRY) writeFileSync(file, out, 'utf8')
  }
}
console.log(`${DRY ? '[dry run] ' : ''}${total} blue utilities ${DRY ? 'would be ' : ''}rebranded`)
