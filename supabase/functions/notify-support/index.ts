import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { name, email, type, message } = await req.json()

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY not configured')

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f5f1e8;border-radius:12px">
        <h2 style="color:#1F5C3F;margin:0 0 4px">📩 Nouveau message — Padel Meet</h2>
        <p style="color:#6B6B6B;font-size:13px;margin:0 0 20px">Reçu le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px;width:80px">Type</td>
              <td style="padding:8px 0;font-weight:600;color:#1A1A1A">${type ?? 'Feedback'}</td></tr>
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px">Nom</td>
              <td style="padding:8px 0;font-weight:600;color:#1A1A1A">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px">Email</td>
              <td style="padding:8px 0;color:#1F5C3F"><a href="mailto:${email}" style="color:#1F5C3F">${email}</a></td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #c9a96140;margin:16px 0"/>
        <p style="color:#1A1A1A;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Padel Meet <onboarding@resend.dev>',
        to:   'jonathanbens10@gmail.com',
        subject: `[Padel Meet] ${type ?? 'Message'} de ${name}`,
        html,
        reply_to: email,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Resend: ${errText}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[notify-support]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
