import { Router, Request, Response } from 'express'
import * as energyService from '../services/energyService'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const { applianceId, energyUsed, voltage, current, power, timestamp, budget, remaining, alert } = req.body
    if (energyUsed === undefined) {
      res.status(400).json({ error: 'energyUsed is required' })
      return
    }
    const reading = await energyService.createReading({
      applianceId: applianceId ? Number(applianceId) : undefined,
      energyUsed: Number(energyUsed),
      voltage: voltage !== undefined ? Number(voltage) : undefined,
      current: current !== undefined ? Number(current) : undefined,
      power: power !== undefined ? Number(power) : undefined,
      timestamp,
      budget,
      remaining,
      alert,
    })
    req.app.get('io')?.emit('reading', reading)
    if (reading.alert) {
      req.app.get('io')?.emit('alert', {
        message: `Energy usage alert! Energy budget threshold reached (${reading.energyUsed.toFixed(2)} kWh used).`,
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
    const { applianceId, from, to, limit, offset, format } = req.query
    const parsedLimit = limit ? Number(limit) : 100
    const result = await energyService.getReadings(
      applianceId ? Number(applianceId) : undefined,
      from ? new Date(from as string) : undefined,
      to ? new Date(to as string) : undefined,
      parsedLimit,
      offset ? Number(offset) : 0
    )
    if (parsedLimit === 1 || format === 'array') {
      res.json(result.readings)
    } else {
      res.json(result)
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
