import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';

const BUCKET = 'fund-facts';

/** Detect fund code from PDF filename using Groq AI */
async function detectFundCode(fileName: string): Promise<{ code: string; name: string } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en fonds communs de placement canadiens. On te donne le nom d'un fichier PDF d'un rapport de fonds (Fund Facts / Aperçu du fonds).
Extrais le code FundSERV (ex: RBF658, TDB900, MFC4367, CIG11115, DSC7133, NB3122) et le nom du fonds.
Réponds UNIQUEMENT en JSON: {"code": "CODE_DU_FOND", "name": "Nom complet du fonds"}
Si tu ne trouves pas de code, essaie de déduire le code depuis le nom du fichier. Si c'est impossible, réponds: {"code": "", "name": ""}`,
        },
        {
          role: 'user',
          content: `Nom du fichier: ${fileName}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (parsed.code) return { code: parsed.code.toUpperCase(), name: parsed.name || '' };
    return null;
  } catch (err) {
    console.error('[FundReports] Groq detection failed:', err);
    return null;
  }
}

/** GET - List all fund documents */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('fund_documents')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST - Upload a fund report PDF */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const manualCode = (formData.get('fund_code') as string)?.trim().toUpperCase() || '';
    const manualName = (formData.get('fund_name') as string)?.trim() || '';

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Un fichier PDF est requis' }, { status: 400 });
    }

    // Detect fund code via AI or use manual input
    let fundCode = manualCode;
    let fundName = manualName;

    if (!fundCode) {
      const detected = await detectFundCode(file.name);
      if (detected) {
        fundCode = detected.code;
        fundName = fundName || detected.name;
      }
    }

    if (!fundCode) {
      return NextResponse.json(
        { error: 'Impossible de détecter le code du fonds. Veuillez le saisir manuellement.', needsManualCode: true },
        { status: 422 }
      );
    }

    const supabase = createClient();

    // Check if fund already exists (update it)
    const { data: existing } = await supabase
      .from('fund_documents')
      .select('id, file_path')
      .eq('fund_code', fundCode)
      .single();

    // Delete old file from storage if updating
    if (existing?.file_path) {
      await supabase.storage.from(BUCKET).remove([existing.file_path]);
    }

    // Upload file to Supabase Storage
    const filePath = `${fundCode}/${Date.now()}_${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[FundReports] Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Erreur lors de l\'upload du fichier' }, { status: 500 });
    }

    // Upsert fund document record
    const docData = {
      fund_code: fundCode,
      fund_name: fundName || fundCode,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      uploaded_by: session.user.id,
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('fund_documents')
        .update(docData)
        .eq('id', existing.id)
        .select()
        .single();
      result = { data, error };
    } else {
      const { data, error } = await supabase
        .from('fund_documents')
        .insert(docData)
        .select()
        .single();
      result = { data, error };
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ...result.data,
      detected: !manualCode,
      message: existing ? `Fonds ${fundCode} mis à jour` : `Fonds ${fundCode} ajouté`,
    }, { status: existing ? 200 : 201 });
  } catch (err) {
    console.error('[FundReports] Upload error:', err);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
