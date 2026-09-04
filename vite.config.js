import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identifiant de build affiché en bas de « Mon compte ». Le numéro de version du package vaut
// 0.0.0 et ne bouge jamais : il n'apprendrait rien. La date de build, elle, répond à la seule
// question qui compte quand quelqu'un signale un bug — « tu es sur quelle version ? ».
const buildId = new Date().toISOString().slice(0, 16).replace('T', ' ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(buildId) }
})
