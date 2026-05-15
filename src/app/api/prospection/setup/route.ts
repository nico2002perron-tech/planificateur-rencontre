import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createClient();

  // Create leads table
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS leads (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        business_name TEXT,
        profession TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        city TEXT NOT NULL DEFAULT '',
        region TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        score INTEGER,
        score_reason TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        claimed_by UUID REFERENCES users(id),
        dncl_checked BOOLEAN NOT NULL DEFAULT false,
        dncl_listed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_claimed_by ON leads(claimed_by);
      CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_unique ON leads(phone);
    `,
  });

  // Create lead_activities table
  const { error: e2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS lead_activities (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        type TEXT NOT NULL DEFAULT 'note',
        outcome TEXT,
        notes TEXT,
        ai_summary TEXT,
        next_action TEXT,
        next_action_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
      CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON lead_activities(user_id);
    `,
  });

  // Create dncl_numbers table
  const { error: e3 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS dncl_numbers (
        phone TEXT PRIMARY KEY,
        added_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  });

  const errors = [e1, e2, e3].filter(Boolean);

  if (errors.length > 0) {
    // Fallback: try creating tables directly if exec_sql RPC doesn't exist
    // Create tables using Supabase insert (tables may need to be created via Supabase dashboard)
    return NextResponse.json({
      message: 'Les tables doivent être créées manuellement dans Supabase Dashboard.',
      sql: getSetupSQL(),
      errors: errors.map((e) => e?.message),
    });
  }

  return NextResponse.json({ message: 'Tables créées avec succès' });
}

export async function GET() {
  return NextResponse.json({ sql: getSetupSQL() });
}

function getSetupSQL(): string {
  return `
-- LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT,
  profession TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  city TEXT NOT NULL DEFAULT '',
  region TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  score INTEGER,
  score_reason TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  claimed_by UUID REFERENCES users(id),
  dncl_checked BOOLEAN NOT NULL DEFAULT false,
  dncl_listed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_claimed_by ON leads(claimed_by);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- LEAD ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'note',
  outcome TEXT,
  notes TEXT,
  ai_summary TEXT,
  next_action TEXT,
  next_action_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON lead_activities(user_id);

-- DNCL (Do Not Call List) TABLE
CREATE TABLE IF NOT EXISTS dncl_numbers (
  phone TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
  `.trim();
}
