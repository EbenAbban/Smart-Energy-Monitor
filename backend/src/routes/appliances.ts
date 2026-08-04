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

router.get('/state', async (_req: Request, res: Response) => {
  try {
    const appliances = await applianceService.getAppliances()
    const state = appliances.map((a) => ({
      relayNumber: a.relayNumber,
      status: a.status,
    }))
    res.json(state)
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

// Physical-button press from ESP32: update status by relay number, not DB id
router.put('/relay/:relayNumber/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const relayNumber = Number(req.params.relayNumber)
    const appliance = await applianceService.updateApplianceStatusByRelay(relayNumber, status)
    req.app.get('io')?.emit('applianceStatus', { applianceId: appliance.id, status: appliance.status })
    res.json(appliance)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// Web dashboard / frontend: update status by appliance DB id
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
    req.app.get('io')?.emit('applianceAdded', appliance)
    res.status(201).json(appliance)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    await applianceService.deleteAppliance(id)
    req.app.get('io')?.emit('applianceDeleted', { id })
    res.status(200).json({ success: true, message: 'Appliance removed' })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router

