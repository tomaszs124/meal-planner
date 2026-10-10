#!/usr/bin/env node
/**
 * One-off codemod: appends `dark:` counterparts to the light-mode colour utilities used
 * in className strings, so the whole app gets a dark theme without hand-editing every
 * file. Idempotent per string literal: a literal that already contains `dark:` is skipped.
 *
 *   node scripts/add-dark-variants.mjs            # rewrite src/**\/*.tsx
 *   node scripts/add-dark-variants.mjs --dry      # report only
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry')
const ROOT = join(process.cwd(), 'src')

const HUES = ['blue', 'green', 'yellow', 'purple', 'indigo', 'red', 'orange', 'amber', 'emerald', 'pink', 'teal']

/** light utility → dark utility to append right after it */
const MAP = new Map([
  ['bg-white', 'dark:bg-gray-800'],
  ['bg-gray-50', 'dark:bg-gray-900'],
  ['bg-gray-100', 'dark:bg-gray-700'],
  ['bg-gray-200', 'dark:bg-gray-600'],
  ['bg-gray-300', 'dark:bg-gray-600'],
  ['hover:bg-white', 'dark:hover:bg-gray-800'],
  ['hover:bg-gray-50', 'dark:hover:bg-gray-700'],
  ['hover:bg-gray-100', 'dark:hover:bg-gray-700'],
  ['hover:bg-gray-200', 'dark:hover:bg-gray-600'],
  ['hover:bg-gray-300', 'dark:hover:bg-gray-500'],
  ['disabled:bg-gray-100', 'dark:disabled:bg-gray-700'],
  ['disabled:bg-gray-400', 'dark:disabled:bg-gray-600'],
  ['border-gray-100', 'dark:border-gray-700'],
  ['border-gray-200', 'dark:border-gray-700'],
  ['border-gray-300', 'dark:border-gray-600'],
  ['hover:border-gray-400', 'dark:hover:border-gray-500'],
  ['divide-gray-200', 'dark:divide-gray-700'],
  ['text-black', 'dark:text-gray-100'],
  ['text-gray-900', 'dark:text-gray-100'],
  ['text-gray-800', 'dark:text-gray-200'],
  ['text-gray-700', 'dark:text-gray-300'],
  ['text-gray-600', 'dark:text-gray-400'],
  ['text-gray-500', 'dark:text-gray-400'],
  ['text-gray-400', 'dark:text-gray-500'],
  ['hover:text-gray-900', 'dark:hover:text-gray-100'],
  ['hover:text-gray-600', 'dark:hover:text-gray-300'],
  ['placeholder:text-gray-400', 'dark:placeholder:text-gray-500'],
  ['ring-offset-2', 'dark:ring-offset-gray-900'],
  ['ring-offset-1', 'dark:ring-offset-gray-900'],
  ['from-gray-100', 'dark:from-gray-700'],
  ['to-gray-200', 'dark:to-gray-800'],
])
for (const c of HUES) {
  MAP.set(`bg-${c}-50`, `dark:bg-${c}-950`)
  MAP.set(`bg-${c}-100`, `dark:bg-${c}-900`)
  MAP.set(`hover:bg-${c}-50`, `dark:hover:bg-${c}-950`)
  MAP.set(`hover:bg-${c}-100`, `dark:hover:bg-${c}-900`)
  MAP.set(`border-${c}-100`, `dark:border-${c}-800`)
  MAP.set(`border-${c}-200`, `dark:border-${c}-800`)
  MAP.set(`border-${c}-300`, `dark:border-${c}-700`)
  MAP.set(`text-${c}-900`, `dark:text-${c}-100`)
  MAP.set(`text-${c}-800`, `dark:text-${c}-200`)
  MAP.set(`text-${c}-700`, `dark:text-${c}-300`)
  MAP.set(`text-${c}-600`, `dark:text-${c}-400`)
  MAP.set(`hover:text-${c}-700`, `dark:hover:text-${c}-300`)
  MAP.set(`hover:text-${c}-900`, `dark:hover:text-${c}-200`)
}

// a class token: not preceded by a word char, ':' or '-', and not followed by a word char, '-' or '/' (opacity modifier)
const tokenRegex = new RegExp(
  `(?<![\\w:\\-])(${[...MAP.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|')})(?![\\w\\-/])`,
  'g'
)

// string literals: "...", '...', `...` (template literals swallowed whole, nested ${} included)
const stringRegex = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g

function transform(source) {
  let changed = 0
  const out = source.replace(stringRegex, (literal) => {
    if (literal.includes('dark:')) return literal
    if (!/(^|[\s"'`{])(bg|text|border|hover|divide|placeholder|ring-offset|from|to|disabled)[-:]/.test(literal)) return literal
    const next = literal.replace(tokenRegex, (token) => {
      changed += 1
      return `${token} ${MAP.get(token)}`
    })
    return next
  })
  return { out, changed }
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) acc.push(p)
  }
  return acc
}

let total = 0
for (const file of walk(ROOT)) {
  const source = readFileSync(file, 'utf8')
  const { out, changed } = transform(source)
  if (changed > 0) {
    total += changed
    console.log(`${changed.toString().padStart(4)}  ${file.replace(process.cwd(), '')}`)
    if (!DRY) writeFileSync(file, out, 'utf8')
  }
}
console.log(`${DRY ? '[dry run] ' : ''}${total} dark variants ${DRY ? 'would be' : ''} added`)
