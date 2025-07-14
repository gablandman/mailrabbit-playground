import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Accept GET requests for the OAuth callback
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Retrieve state (manager's user ID)

    if (!code) {
      console.error('Missing authorization code in URL parameters.');
      return new Response('Missing authorization code', { status: 400 });
    }

    // 1. Exchange the Google authorization code for Gmail tokens
    const GOOGLE_CLIENT_ID_CREATOR = Deno.env.get('GOOGLE_CLIENT_ID_CREATOR');
    const GOOGLE_CLIENT_SECRET_CREATOR = Deno.env.get('GOOGLE_CLIENT_SECRET_CREATOR');
    const GOOGLE_REDIRECT_URI_CREATOR = Deno.env.get('GOOGLE_REDIRECT_URI_CREATOR');

    if (!GOOGLE_CLIENT_ID_CREATOR || !GOOGLE_CLIENT_SECRET_CREATOR || !GOOGLE_REDIRECT_URI_CREATOR) {
      console.error('Missing Google environment variables for creator flow.');
      return new Response('Server configuration error', { status: 500 });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', // Token exchange must always be a POST
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID_CREATOR,
        client_secret: GOOGLE_CLIENT_SECRET_CREATOR,
        redirect_uri: GOOGLE_REDIRECT_URI_CREATOR,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Error exchanging Google code for tokens:', errorText);
      return new Response('Failed to exchange Google code for tokens', { status: tokenResponse.status });
    }

    const { access_token, refresh_token, id_token } = await tokenResponse.json();

    // Decode ID Token to get creator's email and name
    const [header, payload, signature] = id_token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const creatorEmail = decodedPayload.email;
    const creatorName = decodedPayload.name || creatorEmail;

    // 2. Initialize Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Use the manager's user ID from 'state' to associate the creator
    const managerId = state; // This should be the UUID of the manager from public.profiles.id

    if (!managerId || managerId === 'anonymous') { // Basic validation for managerId
        console.error('Invalid or missing manager ID from state parameter.');
        const FRONTEND_ERROR_REDIRECT_URL = Deno.env.get('FRONTEND_ERROR_REDIRECT_URL') || 'http://localhost:5173/dashboard?creator_added=false&error=true&code=invalid_manager_id';
        return new Response(null, { status: 302, headers: { 'Location': FRONTEND_ERROR_REDIRECT_URL } });
    }

    let creatorRecord;
    const { data: existingCreator, error: existingCreatorError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('email_address', creatorEmail)
      .single();

    if (existingCreatorError && existingCreatorError.code === 'PGRST116') { // No rows found
      // Creator does not exist, insert new record
      const { data: newCreator, error: newCreatorError } = await supabaseAdmin
        .from('creators')
        .insert({
          user_id: managerId, // Associate with the manager's ID
          name: creatorName,
          email_address: creatorEmail,
          status: 'active', // Default status for new creators
          gmail_refresh_token: refresh_token, // Now NOT NULL
          automation_mode: 'assistant', // Default mode for MVP (now NOT NULL)
          // preferred_template_id: null, // Can be null for now, or fetch a default template ID
          // context_pool: null, // Can be null for now
          // gmail_history_id will be set after users.watch() call
        })
        .select()
        .single();
      if (newCreatorError) {
        console.error('Error inserting new creator:', newCreatorError.message);
        throw newCreatorError;
      }
      creatorRecord = newCreator;
    } else if (existingCreatorError) {
      console.error('Error querying existing creator:', existingCreatorError.message);
      throw existingCreatorError;
    } else {
      // Creator exists, update refresh token and status
      const { data: updatedCreator, error: updateError } = await supabaseAdmin
        .from('creators')
        .update({
          gmail_refresh_token: refresh_token,
          status: 'active', // Update status to active
          // No need to update automation_mode, preferred_template_id, context_pool here
          // unless explicitly changed by the user in the "add creator" wizard
        })
        .eq('id', existingCreator.id)
        .select()
        .single();
      if (updateError) {
        console.error('Error updating existing creator:', updateError.message);
        throw updateError;
      }
      creatorRecord = updatedCreator;
    }

    if (!creatorRecord) {
      console.error('Creator record could not be created or updated.');
      return new Response('Failed to create or update creator record', { status: 500 });
    }

    // 3. Call Gmail API users.watch()
    const GOOGLE_PUBSUB_TOPIC = Deno.env.get('GOOGLE_PUBSUB_TOPIC');

    if (!GOOGLE_PUBSUB_TOPIC) {
      console.error('GOOGLE_PUBSUB_TOPIC environment variable not configured.');
      return new Response('Server configuration error: Pub/Sub topic missing', { status: 500 });
    }

    const watchResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/${creatorEmail}/watch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`, // Use Google's access_token here
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: GOOGLE_PUBSUB_TOPIC,
        labelIds: ['INBOX'], // Only notify for new emails in INBOX
      }),
    });

    if (!watchResponse.ok) {
      const errorText = await watchResponse.text();
      console.error('Error calling Gmail users.watch():', errorText);
      // Do NOT return a 5xx error here, otherwise Google Pub/Sub will retry indefinitely.
      // Acknowledge the notification but indicate failure.
      return new Response(`Failed to watch Gmail inbox: ${errorText}`, { status: 200 }); // Return 200 OK
    }

    const watchResult = await watchResponse.json();
    console.log(`Gmail watch activated for ${creatorEmail}:`, watchResult);

    // Update the creator's gmail_history_id with the value from watchResult
    if (watchResult.historyId) {
        const { error: historyUpdateError } = await supabaseAdmin
            .from('creators')
            .update({ gmail_history_id: watchResult.historyId })
            .eq('id', creatorRecord.id);
        if (historyUpdateError) {
            console.error('Error updating creator history ID:', historyUpdateError.message);
        }
    }


    // Final redirection to frontend after success
    const FRONTEND_SUCCESS_REDIRECT_URL = Deno.env.get('FRONTEND_SUCCESS_REDIRECT_URL') || 'http://localhost:5173/dashboard?creator_added=true';
    return new Response(null, {
      status: 302,
      headers: {
        'Location': FRONTEND_SUCCESS_REDIRECT_URL,
      },
    });

  } catch (error: any) { // Use 'any' to handle generic error objects
    console.error('Error in handle-gmail-oauth-callback:', error.message);
    const FRONTEND_ERROR_REDIRECT_URL = Deno.env.get('FRONTEND_ERROR_REDIRECT_URL') || 'http://localhost:5173/dashboard?creator_added=false&error=true';
    return new Response(null, {
      status: 302,
      headers: {
        'Location': FRONTEND_ERROR_REDIRECT_URL,
      },
    });
  }
});
