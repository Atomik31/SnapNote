import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En production, Vercel exécute automatiquement les fichiers du dossier `api/`.
// En local, `npm run dev` ne le fait pas : ce petit plugin branche les mêmes fonctions
// sur le serveur de développement, pour ne lancer qu'une seule commande.
function devApi(env) {
  return {
    name: 'dev-api',
    configureServer(server) {
      // Les variables SANS préfixe VITE_ (clé IA…) restent côté serveur : jamais envoyées au navigateur.
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value

      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.match(/^\/api\/([\w-]+)/)
        if (!route) return next()

        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }

        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          try {
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            return res.status(400).json({ error: 'JSON invalide.' })
          }
          const handler = await server.ssrLoadModule(`/api/${route[1]}.js`)
          await handler.default(req, res)
        } catch (error) {
          console.error('[dev-api]', error)
          res.status(500).json({ error: 'Erreur serveur.' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
}))
