const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL

if (!baseUrl) {
  console.error('Missing SUPABASE_URL or REACT_APP_SUPABASE_URL')
  process.exit(1)
}

const functionsToProbe = ['create-entreprise', 'create-user', 'create-pointage']

async function probeFunction(name) {
  const endpoint = `${baseUrl}/functions/v1/${name}`

  const response = await fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://qa.velor-one.test',
      'Access-Control-Request-Method': 'POST',
    },
  })

  // Missing edge functions typically answer 404; any other status means endpoint exists.
  const ok = response.status !== 404
  return {
    name,
    status: response.status,
    ok,
  }
}

async function main() {
  const results = []

  for (const fnName of functionsToProbe) {
    const result = await probeFunction(fnName)
    results.push(result)
  }

  const failed = results.filter((r) => !r.ok)

  console.log(JSON.stringify({ baseUrl, results }, null, 2))

  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
