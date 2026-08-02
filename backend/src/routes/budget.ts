import { Router, Request, Response } from 'express'
import * as budgetService from '../services/budgetService'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const budget = await budgetService.getCurrentBudget()
    res.json(budget ?? { maximumEnergy: 1000, currentUsage: 0, status: 'active' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', async (req: Request, res: Response) => {
  try {
    const { maximumEnergy } = req.body
    if (!maximumEnergy) {
      res.status(400).json({ error: 'maximumEnergy is required' })
      return
    }
    const budget = await budgetService.setBudget(maximumEnergy)
    req.app.get('io')?.emit('budgetUpdate', { used: budget.currentUsage, maximum: budget.maximumEnergy })
    res.json(budget)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
