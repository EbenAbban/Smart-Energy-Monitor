import { Router, Request, Response } from 'express'
import * as energyService from '../services/energyService'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const { applianceId, energyUsed, voltage, current, power, frequency, powerFactor, timestamp, budget, remaining, alert } = req.body
    if (energyUsed === undefined) {
      res.status(400).json({ error: 'energyUsed is required' })
      return
    }
    const numVoltage = voltage != null && !isNaN(Number(voltage)) && Number(voltage) > 0 ? Number(voltage) : 230
    const numCurrent = current != null && !isNaN(Number(current)) ? Number(current) : 0
    const numPower = power != null && !isNaN(Number(power)) && Number(power) >= 0 ? Number(power) : (numCurrent * numVoltage)
    const numFrequency = frequency != null && !isNaN(Number(frequency)) ? Number(frequency) : 50
    const numPowerFactor = powerFactor != null && !isNaN(Number(powerFactor)) ? Number(powerFactor) : 1.0

    const reading = await energyService.createReading({
      applianceId: applianceId ? Number(applianceId) : undefined,
      energyUsed: Number(energyUsed),
      voltage: numVoltage,
      current: numCurrent,
      power: numPower,
      frequency: numFrequency,
      powerFactor: numPowerFactor,
      timestamp,
      budget: budget != null ? Number(budget) : undefined,
      remaining: remaining != null ? Number(remaining) : undefined,
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
