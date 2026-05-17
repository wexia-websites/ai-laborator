'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Role = 'super_admin' | 'admin' | 'analyst' | 'viewer'

export const SUPER_ADMIN_EMAIL = 'katzithebeast@gmail.com'

const PERMISSIONS: Record<string, Role[]> = {
  chat:          ['admin', 'analyst', 'viewer'],
  dashboard:     ['admin', 'analyst'],
  inbox:         ['admin', 'analyst'],
  'ai-watch':    ['admin', 'analyst'],
  claimboard:    ['admin', 'analyst'],
  verify:        ['admin'],
  'tools-tested':['admin'],
  usecases:      ['admin', 'analyst', 'viewer'],
  revision:      ['admin'],
  projects:      ['admin', 'analyst'],
  ranking:       ['admin', 'analyst', 'viewer'],
  review:        ['admin'],
  settings:      ['admin'],
  admin:         [],
}

export function useRole() {
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (!user) { setLoading(false); return }
      setEmail(user.email || null)

      if (user.email === SUPER_ADMIN_EMAIL) {
        setRole('super_admin')
        setLoading(false)
        return
      }

      supabase.from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }: any) => {
          setRole((data?.role as Role) || 'viewer')
          setLoading(false)
        })
    })
  }, [])

  const canAccess = (page: string): boolean => {
    if (role === 'super_admin') return true
    return PERMISSIONS[page]?.includes(role as Role) || false
  }

  const canEdit = (): boolean => ['super_admin', 'admin'].includes(role || '')
  const canDelete = (): boolean => role === 'super_admin'
  const canManageUsers = (): boolean => role === 'super_admin'

  return { role, loading, email, canAccess, canEdit, canDelete, canManageUsers }
}
