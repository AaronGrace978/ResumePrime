/// <reference types="vite/client" />

import type { PrimeAPI } from '../shared/prime-api'

declare global {
  interface Window {
    prime: PrimeAPI
  }
}

export {}
