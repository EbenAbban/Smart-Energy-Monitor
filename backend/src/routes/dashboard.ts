import { Router, Request, Response } from 'express'
import * as energyService from '../services/energyService'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await energyService.getDashboardData()
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
