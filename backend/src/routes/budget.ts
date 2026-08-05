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

    // Capture the old budget status before setBudget overwrites it
    const previous = await budgetService.getCurrentBudget()
    const wasExceeded = previous?.status === 'exceeded'

    const budget = await budgetService.setBudget(Number(maximumEnergy))

    // Determine whether this was a recharge (overflow carry-over) or a plain update
    const wasRecharged = wasExceeded && budget.status === 'active'
    const carryOver = wasRecharged ? budget.currentUsage : undefined

    // Always emit budgetUpdate so dashboard gauge/stats refresh immediately
    req.app.get('io')?.emit('budgetUpdate', {
      used: budget.currentUsage,
      maximum: budget.maximumEnergy,
      status: budget.status,
    })

    // Additionally emit budgetReset so the settings page can show a specific toast
    if (wasRecharged) {
      req.app.get('io')?.emit('budgetReset', {
        carryOver,
        maximum: budget.maximumEnergy,
        remaining: budget.maximumEnergy - (carryOver ?? 0),
      })
    }

    res.json({ ...budget, wasRecharged, carryOver })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
