const required = process.argv.slice(2)

if (required.length === 0) {
  console.error('Usage: node scripts/check-required-env.mjs <ENV_NAME> [ENV_NAME...]')
  process.exit(1)
}

const missing = required.filter((name) => {
  const value = process.env[name]
  return !value || String(value).trim().length === 0
})

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

console.log(`Environment check OK: ${required.join(', ')}`)
