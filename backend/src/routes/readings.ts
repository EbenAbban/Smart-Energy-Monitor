import { Router, Request, Response } from 'express'
import * as energyService from '../services/energyService'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const { applianceId, energyUsed, voltage, current, power } = req.body
    if (!applianceId || energyUsed === undefined) {
      res.status(400).json({ error: 'applianceId and energyUsed are required' })
      return
    }
    const reading = await energyService.createReading({ applianceId, energyUsed, voltage, current, power })
    req.app.get('io')?.emit('reading', reading)
    if (reading.alert) {
      req.app.get('io')?.emit('alert', {
        message: `Energy usage exceeds 90% of budget for appliance #${applianceId}`,
        level: 'warning',
      })
    }
    res.status(201).json(reading)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const { applianceId, from, to, limit, offset } = req.query
    const result = await energyService.getReadings(
      applianceId ? Number(applianceId) : undefined,
      from ? new Date(from as string) : undefined,
      to ? new Date(to as string) : undefined,
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0
    )
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
