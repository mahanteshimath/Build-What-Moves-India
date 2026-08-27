import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import queryHandler from './api/query.ts'

function apiPlugin(): Plugin {
  return {
    name: 'api-query-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/query' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString()
          })
          req.on('end', async () => {
            try {
              const parsedBody = body ? JSON.parse(body) : {}
              const apiReq = { method: req.method, body: parsedBody }
              const apiRes = {
                status: (code: number) => {
                  res.statusCode = code
                  return apiRes
                },
                json: (data: unknown) => {
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(data))
                },
                setHeader: (name: string, value: string) => {
                  res.setHeader(name, value)
                },
              }
              await queryHandler(apiReq, apiRes)
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: (err as Error).message }))
            }
          })
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})

