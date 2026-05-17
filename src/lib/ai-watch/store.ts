import 'server-only'

import * as local from './localStore'
import * as supabase from './supabaseStore'
import type { AiWatchItem, AiWatchRun, AiWatchRunTrigger, AiWatchSkipList } from './types'

type StoreDriver = {
  readAiWatchItems(): Promise<AiWatchItem[]>
  readAiWatchRuns(): Promise<AiWatchRun[]>
  saveAiWatchRun(run: AiWatchRun): Promise<void>
  createAiWatchRun(model: string, trigger?: AiWatchRunTrigger): AiWatchRun
  insertAiWatchItems(incoming: AiWatchItem[]): Promise<{ items: AiWatchItem[]; insertedCount: number }>
  listAiWatchFeed(): Promise<{ items: AiWatchItem[]; runs: AiWatchRun[] }>
  getSkipList(skipDays: number): Promise<AiWatchSkipList>
}

function pickDriver(): StoreDriver {
  const choice = (process.env.AI_WATCH_STORE ?? 'supabase').toLowerCase()
  return choice === 'local' ? (local as StoreDriver) : (supabase as StoreDriver)
}

const driver = pickDriver()

export const readAiWatchItems = () => driver.readAiWatchItems()
export const readAiWatchRuns = () => driver.readAiWatchRuns()
export const saveAiWatchRun = (run: AiWatchRun) => driver.saveAiWatchRun(run)
export const createAiWatchRun = (model: string, trigger: AiWatchRunTrigger = 'manual') => driver.createAiWatchRun(model, trigger)
export const insertAiWatchItems = (incoming: AiWatchItem[]) => driver.insertAiWatchItems(incoming)
export const listAiWatchFeed = () => driver.listAiWatchFeed()
export const getSkipList = (skipDays: number) => driver.getSkipList(skipDays)

export function getActiveStore(): 'local' | 'supabase' {
  return (process.env.AI_WATCH_STORE ?? 'supabase').toLowerCase() === 'local' ? 'local' : 'supabase'
}
