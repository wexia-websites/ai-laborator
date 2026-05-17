'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      router.replace(session ? '/app/chat' : '/login')
    })
  }, [router])
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#aaa' }}>Načítám…</div>
}
