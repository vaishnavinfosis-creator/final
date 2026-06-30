import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, password, location_id, phone } = await req.json()
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Auth Header' }), { status: 401 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single()

    if (profile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: newAdminData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { role: 'admin', location_id, name: 'Admin Staff', phone }
    })

    if (createError) throw createError

    if (phone) {
      // Attempt to update phone in profiles, ignoring error if column doesn't exist
      await supabaseAdmin.from('profiles').update({ phone }).eq('id', newAdminData.user.id)
    }

    return new Response(JSON.stringify({ user: newAdminData.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
