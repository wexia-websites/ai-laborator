import { supabase } from '@/lib/supabase'

export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single()
  return data?.onboarding_completed ?? false
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId)
}
