import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { logId, wasHelpful, alreadyRead } = body;

    if (!logId) {
      return Response.json({ error: 'logId is required to submit feedback.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json({ error: 'Supabase is not configured on the server.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from('recommendation_feedback')
      .insert({
        recommendation_log_id: logId,
        was_helpful: wasHelpful !== undefined ? wasHelpful : null,
        already_read: alreadyRead !== undefined ? alreadyRead : null,
      });

    if (error) {
      console.error('Failed to insert feedback to Supabase:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Thank you for your cozy feedback!' });
  } catch (err) {
    console.error('Feedback API error:', err);
    return Response.json({ error: 'Failed to process feedback submission.' }, { status: 500 });
  }
}
