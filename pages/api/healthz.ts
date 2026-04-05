/**
 * pages/api/healthz.ts
 * Simple health-check endpoint.
 * Vercel (and uptime monitors) hit GET /healthz to verify the app is live.
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ status: 'ok', app: 'Credix', timestamp: new Date().toISOString() })
}
