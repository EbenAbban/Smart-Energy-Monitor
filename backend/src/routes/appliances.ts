import { Router, Request, Response } from 'express'
import * as applianceService from '../services/applianceService'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const appliances = await applianceService.getAppliances()
    res.json(appliances)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const appliance = await applianceService.getApplianceById(Number(req.params.id))
    if (!appliance) {
      res.status(404).json({ error: 'Appliance not found' })
      return
    }
    res.json(appliance)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const appliance = await applianceService.updateApplianceStatus(Number(req.params.id), status)
    req.app.get('io')?.emit('applianceStatus', { applianceId: appliance.id, status: appliance.status })
    res.json(appliance)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, powerRating, relayNumber, icon } = req.body
    if (!name || !powerRating || relayNumber === undefined) {
      res.status(400).json({ error: 'name, powerRating, and relayNumber are required' })
      return
    }
    const appliance = await applianceService.createAppliance({ name, powerRating, relayNumber, icon })
    res.status(201).json(appliance)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
