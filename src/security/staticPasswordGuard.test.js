import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const TARGET_DIRS = ['src', 'supabase/functions', 'scripts']
const FORBIDDEN_PATTERNS = [
  /Velor2024/gi,
  /Mot de passe temporaire\s*:\s*Velor2024/gi,
  /defaultPassword\s*=\s*['\"]/gi,
  /temporaryPassword\s*=\s*['\"]/gi,
]

function listFilesRecursively(baseDir) {
  const out = []
  if (!fs.existsSync(baseDir)) return out

  const stack = [baseDir]
  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git') continue
        stack.push(fullPath)
      } else if (/\.(js|jsx|ts|tsx|mjs|sql|md)$/i.test(entry.name)) {
        out.push(fullPath)
      }
    }
  }
  return out
}

describe('security static password guard', () => {
  test('forbidden static password literals are not present in tracked sources', () => {
    const files = TARGET_DIRS.flatMap((relativeDir) => listFilesRecursively(path.join(ROOT, relativeDir)))
    const violations = []

    files.forEach((filePath) => {
      if (filePath.endsWith(path.join('src', 'security', 'staticPasswordGuard.test.js'))) return
      const content = fs.readFileSync(filePath, 'utf8')
      FORBIDDEN_PATTERNS.forEach((pattern) => {
        if (pattern.test(content)) {
          violations.push(`${filePath} matches ${pattern}`)
        }
      })
    })

    expect(violations).toEqual([])
  })
})
