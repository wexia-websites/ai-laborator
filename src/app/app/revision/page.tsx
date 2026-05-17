'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type UseCase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

export default function RevisionPage() {
  const router = useRouter()
  const { role, canEdit, canAccess, loading: roleLoading } = useRole()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [items, setItems] = useState<UseCase[]>([])

  useEffect(() => {
    if (!roleLoading && !canAccess('revision')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => setCurrentUserId(user?.id ?? null))
  }, [])

  const canEditItem = (u: UseCase) => canEdit() || (u as any).author_id === currentUserId

  const load = async () => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('use_cases')
      .select('*')
      .eq('status', 'published')
      .or(`revision_status.eq.due,revision_due_at.lte.${now}`)
      .order('revision_due_at', { ascending: true })
    setItems((data ?? []) as UseCase[])
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const renewRevision = async (id: string) => {
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'revision_days').single()
    const days = parseInt(setting?.value ?? '90')
    const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    await supabase.from('use_cases')
      .update({ revision_due_at: due.toISOString(), revision_status: 'ok' })
      .eq('id', id)
    load()
  }

  const archiveItem = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'archived' }).eq('id', id)
    load()
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('cs-CZ')

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Revize use casů</h1>
          <p>Publikované use casy, které je čas zkontrolovat a aktualizovat.</p>
        </div>
      </div>
      <div className="page-body">
        {items.length === 0
          ? <div className="empty"><span className="empty-icon">✅</span>Žádné use casy nečekají na revizi.</div>
          : items.map(u => {
              const uc = u as any
              const dueDate = uc.revision_due_at ? new Date(uc.revision_due_at) : null
              const daysOverdue = dueDate
                ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0
              return (
                <div key={u.id} className="revision-item">
                  <div style={{ flex: 1 }}>
                    <div className="revision-title">{u.title}</div>
                    <div className="revision-meta">
                      {u.tool_name && <>{u.tool_name} · </>}
                      {u.team && <>{u.team} · </>}
                      autor: {u.author_name}
                    </div>
                    <div className="revision-dates">
                      {uc.published_at && (
                        <span>Publikováno: {formatDate(uc.published_at)}</span>
                      )}
                      {dueDate && (
                        <span className="revision-overdue">
                          Revize: {formatDate(uc.revision_due_at)}
                          {daysOverdue > 0 && ` · ${daysOverdue} dní po termínu`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="revision-actions">
                    <button className="btn btn-accent btn-sm" onClick={() => renewRevision(u.id)}>
                      ✅ Stále aktuální
                    </button>
                    {canEditItem(u) && (
                      <button className="btn btn-outline btn-sm" onClick={() => router.push('/app/usecases')}>
                        ✏️ Upravit
                      </button>
                    )}
                    {canEditItem(u) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => archiveItem(u.id)}>
                        🗄️ Archivovat
                      </button>
                    )}
                  </div>
                </div>
              )
            })
        }
      </div>
    </>
  )
}
