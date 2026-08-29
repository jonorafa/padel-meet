import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS restreint : plus de wildcard.
// Ajouter le domaine personnalisé ici dès qu'il est acheté.
const ALLOWED_ORIGINS = new Set([
  'https://padel-meet.vercel.app',
  'http://localhost:5173',
  'http://localhost:5299',
])

function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// Échappement complet : & EN PREMIER, sinon on double-échappe les entités.
// Couvre corps de HTML ET contexte d'attribut (guillemets inclus).
function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Nettoyage pour le sujet : pas de retour ligne = pas d'injection d'en-tête.
function sanitizeHeader(v: unknown, max = 120): string {
  return String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, max).trim()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RATE_LIMIT_MAX = 3          // messages autorisés…
const RATE_LIMIT_WINDOW_MS = 3600_000  // …par heure et par utilisateur

serve(async (req) => {
  const CORS = corsFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Authentification obligatoire ────────────────────────────────────
    // Défense en profondeur : verify_jwt=true rejette déjà les requêtes sans
    // jeton en amont (config.toml), mais on revérifie ici pour ne pas dépendre
    // d'un seul cran — et parce qu'on a besoin de user.id de toute façon.
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Client « utilisateur » : sert UNIQUEMENT à valider le jeton et récupérer
    // l'identité. Il tourne sous le rôle `authenticated`, donc soumis à la RLS.
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Client « service » : sert UNIQUEMENT au compteur anti-abus.
    //
    // Pourquoi un second client plutôt que réutiliser celui de l'utilisateur :
    // support_rate_limit a la RLS activée SANS aucune policy (migration 037),
    // volontairement — la table ne doit être accessible par personne en REST.
    // Sous le rôle `authenticated`, PostgreSQL renverrait alors count=0 à
    // chaque SELECT (aucune ligne visible, et AUCUNE erreur levée) et
    // rejetterait chaque INSERT. Le compteur serait donc éternellement à 0 :
    // la limite ne se déclencherait jamais, en silence. C'est la même
    // mécanique que le piège RLS déjà rencontré sur Storage dans ce projet.
    // Le rôle service_role contourne la RLS, ce qui est exactement l'intention
    // ici : seule cette fonction, côté serveur, écrit dans cette table.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // ── Limitation de débit : 3 messages / heure / utilisateur ──────────
    const depuis = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const { count, error: rlErr } = await supabaseAdmin
      .from('support_rate_limit')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', depuis)

    if (rlErr) throw new Error(`rate-limit check: ${rlErr.message}`)
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Validation des entrées ──────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const name    = String(body.name    ?? '').trim().slice(0, 120)
    const email   = String(body.email   ?? '').trim().slice(0, 200)
    const type    = String(body.type    ?? 'Feedback').trim().slice(0, 60)
    const message = String(body.message ?? '').trim().slice(0, 5000)

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (!EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY not configured')

    // Toutes les valeurs sont échappées, y compris dans le href : un guillemet
    // dans `email` sortait sinon de l'attribut mailto et permettait d'injecter
    // un lien de hameçonnage dans l'e-mail reçu.
    const safeName    = escapeHtml(name)
    const safeEmail   = escapeHtml(email)
    const safeType    = escapeHtml(type)
    const safeMessage = escapeHtml(message)

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f5f1e8;border-radius:12px">
        <h2 style="color:#1F5C3F;margin:0 0 4px">📩 Nouveau message — Padel Meet</h2>
        <p style="color:#6B6B6B;font-size:13px;margin:0 0 20px">Reçu le ${new Date().toISOString()}</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px;width:80px">Type</td>
              <td style="padding:8px 0;font-weight:600;color:#1A1A1A">${safeType}</td></tr>
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px">Nom</td>
              <td style="padding:8px 0;font-weight:600;color:#1A1A1A">${safeName}</td></tr>
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px">Email</td>
              <td style="padding:8px 0;color:#1F5C3F"><a href="mailto:${safeEmail}" style="color:#1F5C3F">${safeEmail}</a></td></tr>
          <tr><td style="padding:8px 0;color:#6B6B6B;font-size:13px">User ID</td>
              <td style="padding:8px 0;color:#6B6B6B;font-size:12px">${escapeHtml(user.id)}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #c9a96140;margin:16px 0"/>
        <p style="color:#1A1A1A;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap">${safeMessage}</p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // TODO(domaine) : remplacer from par contact@<domaine> ET to par
        // padelmeet.il@gmail.com une fois SPF+DKIM vérifiés dans Resend.
        // onboarding@resend.dev est le domaine bac à sable partagé : il ne
        // peut écrire QU'à l'adresse propriétaire du compte Resend — testé
        // en direct le 2026-08-29, padelmeet.il@gmail.com y était rejeté
        // avec un 403 (Resend validation_error), transformé en 500 générique
        // côté client. jonathanbens10@gmail.com est cette adresse compte.
        from: 'Padel Meet <onboarding@resend.dev>',
        to:   'jonathanbens10@gmail.com',
        subject: `[Padel Meet] ${sanitizeHeader(type)} de ${sanitizeHeader(name)}`,
        html,
        reply_to: email, // validé par EMAIL_RE ci-dessus
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Resend: ${errText}`)
    }

    // Enregistre l'envoi pour la limitation de débit. L'erreur est vérifiée et
    // tracée : si cette écriture échoue en silence, le compteur reste à 0 et
    // la limite ne protège plus rien. On ne fait pas échouer la requête pour
    // autant — l'e-mail est déjà parti, renvoyer une erreur au joueur serait
    // trompeur.
    const { error: insErr } = await supabaseAdmin
      .from('support_rate_limit')
      .insert({ user_id: user.id })
    if (insErr) console.error('[notify-support] rate-limit insert:', insErr.message)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[notify-support]', err)
    // Ne jamais renvoyer le détail de l'erreur au client.
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
