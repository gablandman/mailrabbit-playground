import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Accepter les requêtes GET pour le callback OAuth
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Récupérer l'état si vous le transmettez

    if (!code) {
      console.error('Missing authorization code in URL parameters.');
      return new Response('Missing authorization code', { status: 400 });
    }

    // Si vous utilisez le `state` pour associer au manager, vous pouvez le récupérer ici
    // et l'utiliser lors de l'insertion ou de la mise à jour dans la table `creators`.
    // const userIdFromState = state; // Assurez-vous que votre 'state' est l'ID de l'utilisateur ou une chaîne sécurisée

    // 1. Échanger le code d'autorisation Google contre les tokens Gmail
    const GOOGLE_CLIENT_ID_CREATOR = Deno.env.get('GOOGLE_CLIENT_ID_CREATOR');
    const GOOGLE_CLIENT_SECRET_CREATOR = Deno.env.get('GOOGLE_CLIENT_SECRET_CREATOR');
    const GOOGLE_REDIRECT_URI_CREATOR = Deno.env.get('GOOGLE_REDIRECT_URI_CREATOR');

    if (!GOOGLE_CLIENT_ID_CREATOR || !GOOGLE_CLIENT_SECRET_CREATOR || !GOOGLE_REDIRECT_URI_CREATOR) {
      console.error('Variables d\'environnement Google pour créateur manquantes.');
      return new Response('Server configuration error', { status: 500 });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', // L'échange de code doit toujours être un POST
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
      console.error('Erreur lors de l\'échange de code Google:', errorText);
      return new Response('Failed to exchange Google code for tokens', { status: tokenResponse.status });
    }

    const { access_token, refresh_token, id_token } = await tokenResponse.json();

    const [header, payload, signature] = id_token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const creatorEmail = decodedPayload.email;
    const creatorName = decodedPayload.name || creatorEmail;

    // 2. Initialiser le client Supabase avec le rôle de service
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Utilisez l'ID du manager stocké dans le 'state' pour l'associer au créateur
    // Dans votre frontend, quand vous construisez l'URL de redirection pour le créateur:
    // const authUrl = `...&state=${session?.user.id || 'no_manager_id'}&...`;
    // const userId = state; // Assuming 'state' contains the Supabase user ID of the manager
    // Si le manager est authentifié via Supabase, vous pouvez récupérer son UID via le state
    const managerId = state; // ou 'no_manager_id' si vous ne l'utilisez pas ou le gérez différemment

    let creatorRecord;
    const { data: existingCreator, error: existingCreatorError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('email_address', creatorEmail)
      .single();

    if (existingCreatorError && existingCreatorError.code === 'PGRST116') { // Not found
        const { data: newCreator, error: newCreatorError } = await supabaseAdmin
            .from('creators')
            .insert({
                user_id: managerId, // Associer au manager via l'ID récupéré du state
                name: creatorName,
                email_address: creatorEmail,
                status: 'active',
                gmail_refresh_token: refresh_token,
            })
            .select()
            .single();
        if (newCreatorError) throw newCreatorError;
        creatorRecord = newCreator;
    } else if (existingCreatorError) {
        throw existingCreatorError;
    } else {
        const { data: updatedCreator, error: updateError } = await supabaseAdmin
            .from('creators')
            .update({ gmail_refresh_token: refresh_token, status: 'active' })
            .eq('id', existingCreator.id)
            .select()
            .single();
        if (updateError) throw updateError;
        creatorRecord = updatedCreator;
    }

    if (!creatorRecord) {
        return new Response('Failed to create or update creator record', { status: 500 });
    }

    // 3. Appeler Gmail API users.watch()
    const GOOGLE_PUBSUB_TOPIC = Deno.env.get('GOOGLE_PUBSUB_TOPIC');

    if (!GOOGLE_PUBSUB_TOPIC) {
        console.error('GOOGLE_PUBSUB_TOPIC non configuré.');
        return new Response('Server configuration error: Pub/Sub topic missing', { status: 500 });
    }

    const watchResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/${creatorEmail}/watch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: GOOGLE_PUBSUB_TOPIC,
        labelIds: ['INBOX'],
      }),
    });

    if (!watchResponse.ok) {
      const errorText = await watchResponse.text();
      console.error('Erreur lors de l\'appel à Gmail users.watch():', errorText);
      return new Response(`Failed to watch Gmail inbox: ${errorText}`, { status: watchResponse.status });
    }

    const watchResult = await watchResponse.json();
    console.log(`Gmail watch activé pour ${creatorEmail}:`, watchResult);

    // Redirection finale vers le frontend après succès
    const FRONTEND_SUCCESS_REDIRECT_URL = Deno.env.get('FRONTEND_SUCCESS_REDIRECT_URL') || 'http://localhost:5173/auth?status=creator_added';
    return new Response(null, {
        status: 302,
        headers: {
            'Location': FRONTEND_SUCCESS_REDIRECT_URL,
        },
    });

  } catch (error) {
    console.error('Erreur dans handle-gmail-oauth-callback:', error.message);
    const FRONTEND_ERROR_REDIRECT_URL = Deno.env.get('FRONTEND_ERROR_REDIRECT_URL') || 'http://localhost:5173/auth?status=creator_error';
    return new Response(null, {
        status: 302,
        headers: {
            'Location': FRONTEND_ERROR_REDIRECT_URL,
        },
    });
  }
});