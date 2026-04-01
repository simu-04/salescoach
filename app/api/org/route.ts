/**
 * POST /api/org
 *
 * Handles two actions:
 *   create — create a new organization, set caller as admin
 *   join   — join an existing org by slug, set caller as rep (pending)
 */
import { NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import type { ApiError } from '@/types'

export async function POST(request: Request) {
  try {
    // Verify auth with cookie client
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client for all DB writes — bypasses RLS so we can
    // create the org and set the profile in one shot without chicken-and-egg
    // policy issues (user has no org yet, so org SELECT/INSERT policies fail).
    const admin = createServerAdminClient()

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { name, slug } = body
      if (!name || !slug) {
        return NextResponse.json<ApiError>({ error: 'name and slug required' }, { status: 400 })
      }

      // Create org
      const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({ name, slug })
        .select()
        .single()

      if (orgError) {
        const msg = orgError.code === '23505'
          ? 'That workspace ID is already taken. Choose a different one.'
          : orgError.message
        return NextResponse.json<ApiError>({ error: msg }, { status: 409 })
      }

      // Set caller as admin of that org
      const { error: profileError } = await admin
        .from('profiles')
        .update({ org_id: org.id, role: 'admin' })
        .eq('id', user.id)

      if (profileError) {
        return NextResponse.json<ApiError>({ error: profileError.message }, { status: 500 })
      }

      return NextResponse.json({ org })

    } else if (action === 'join') {
      const { slug } = body
      if (!slug) {
        return NextResponse.json<ApiError>({ error: 'slug required' }, { status: 400 })
      }

      // Find org by slug (admin client — user has no org yet so RLS blocks SELECT)
      const { data: org, error: findError } = await admin
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', slug)
        .single()

      if (findError || !org) {
        return NextResponse.json<ApiError>(
          { error: 'Workspace not found. Check the ID and try again.' },
          { status: 404 }
        )
      }

      // Set caller as pending rep of that org
      const { error: profileError } = await admin
        .from('profiles')
        .update({ org_id: org.id, role: 'pending' })
        .eq('id', user.id)

      if (profileError) {
        return NextResponse.json<ApiError>({ error: profileError.message }, { status: 500 })
      }

      return NextResponse.json({ org })

    } else {
      return NextResponse.json<ApiError>({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (err) {
    console.error('POST /api/org error:', err)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
