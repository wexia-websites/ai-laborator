import { redirect } from 'next/navigation'

export default function VerifyRedirect() {
  redirect('/app/approval?tab=audits')
}
