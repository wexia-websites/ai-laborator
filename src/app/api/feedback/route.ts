import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Větší limit pro base64 screenshot
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { screenshot_base64, ...feedbackData } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Service role klient — obchází RLS
    const supabase = createClient(supabaseUrl, serviceKey)

    let screenshotUrl: string | null = null

    // Upload screenshotu do Storage
    if (screenshot_base64) {
      console.log('Feedback API: uploading screenshot...')
      const buffer = Buffer.from(screenshot_base64, 'base64')
      const fileName = `feedback_${Date.now()}.png`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('feedback-screenshots')
        .upload(fileName, buffer, { contentType: 'image/png' })

      if (uploadError) {
        console.error('Feedback API: storage upload error:', uploadError)
      } else if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('feedback-screenshots')
          .getPublicUrl(uploadData.path)
        screenshotUrl = urlData.publicUrl
        console.log('Feedback API: screenshot uploaded:', screenshotUrl)
      }
    }

    // Ulož do DB
    const { error: dbError } = await supabase
      .from('feedback')
      .insert({ ...feedbackData, screenshot_url: screenshotUrl })

    if (dbError) {
      console.error('Feedback API: DB insert error:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    console.log('Feedback API: saved, screenshot_url:', screenshotUrl)
    return NextResponse.json({ success: true, screenshot_url: screenshotUrl })
  } catch (err) {
    console.error('Feedback API: unexpected error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
