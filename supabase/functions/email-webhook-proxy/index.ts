// supabase/functions/email-webhook-proxy/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fonction utilitaire pour décoder les données de notification Pub/Sub
function decodePubSubMessage(message: any): { emailAddress: string, historyId: string } | null {
    try {
        const data = JSON.parse(atob(message.data));
        // La structure de la notification Gmail API Users.watch() est :
        // { "emailAddress": "user@example.com", "historyId": "12345" }
        return {
            emailAddress: data.emailAddress,
            historyId: data.historyId
        };
    } catch (e) {
        console.error('Erreur de décodage du message Pub/Sub:', e);
        return null;
    }
}

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const notification = await req.json();

        // Vérifier que c'est bien une notification Pub/Sub structurée
        if (!notification || !notification.message || !notification.message.data) {
            console.warn('Notification Pub/Sub invalide reçue.');
            return new Response('Bad Request: Invalid Pub/Sub message format', { status: 400 });
        }

        const decodedMessage = decodePubSubMessage(notification.message);
        if (!decodedMessage) {
            return new Response('Bad Request: Could not decode Pub/Sub message data', { status: 400 });
        }

        const { emailAddress, historyId } = decodedMessage;
        console.log(`Notification reçue pour : ${emailAddress}, History ID: ${historyId}`);

        // 1. Initialiser le client Supabase avec le rôle de service (pour ignorer les RLS et accéder à tout)
        // ATTENTION : Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY dans le frontend.
        // Cette clé est accessible via Deno.env.get() dans les Edge Functions déployées sur Supabase.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 2. Récupérer les paramètres du créateur et vérifier son statut (active/inactive)
        const { data: creator, error: creatorError } = await supabaseAdmin
            .from('creators')
            .select('id, name, email_address, status, gmail_refresh_token, user_id')
            .eq('email_address', emailAddress)
            .single();

        if (creatorError || !creator) {
            console.error(`Créateur non trouvé ou erreur de base de données pour ${emailAddress}:`, creatorError?.message);
            return new Response('Creator not found or database error', { status: 404 });
        }

        if (creator.status !== 'active') {
            console.log(`Créateur ${creator.email_address} est inactif. Ignoré.`);
            // Renvoie 200 OK pour ne pas re-déclencher la notification Google Pub/Sub
            return new Response('Creator inactive, notification ignored', { status: 200 });
        }

        // TODO: (Futur) Vérifier les limites du plan du créateur ici si nécessaire.
        // const { data: profile, error: profileError } = await supabaseAdmin
        //     .from('profiles')
        //     .select('subscription_status')
        //     .eq('id', creator.user_id)
        //     .single();
        // if (profileError || !profile) { /* Gérer l'erreur */ }
        // if (profile.subscription_status === 'free' && /* quota dépassé */ ) {
        //     return new Response('Quota exceeded', { status: 403 });
        // }

        // 3. Appeler l'API Gmail pour récupérer le contenu de l'email
        console.log(`Tentative de récupération des nouveaux emails pour ${creator.email_address}...`);
        const accessToken = await getGmailAccessToken(creator.gmail_refresh_token);
        if (!accessToken) {
            console.error(`Could not get access token for ${creator.email_address}.`);
            return new Response('Failed to get Gmail access token', { status: 200 });
        }

        const { emails: newEmails, newHistoryId } = await getNewEmails(accessToken, creator.email_address, historyId);

        // Update the creator's gmail_history_id with the latest one
        if (newHistoryId && newHistoryId !== creator.gmail_history_id) {
            const { error: updateError } = await supabaseAdmin
                .from('creators')
                .update({ gmail_history_id: newHistoryId })
                .eq('id', creator.id);
            if (updateError) {
                console.error('Error updating creator history ID:', updateError.message);
            }
        }

        // 4. Préparer le payload pour n8n
        const n8nPayload = {
            creator_id: creator.id,
            creator_email: creator.email_address,
            automation_mode: creator.automation_mode || 'assistant', // Assurez-vous que cette colonne existe
            // context_pool: await getContextForCreator(creator.id), // Fetch context du DB - À implémenter plus tard
            emails: newEmails,
            // Ajoutez ici toute autre information nécessaire pour n8n
        };

        // 5. Appeler le webhook n8n
        // Assurez-vous de définir N8N_WEBHOOK_URL dans les variables d'environnement de Supabase Functions
        const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
        if (!n8nWebhookUrl) {
            console.error('N8N_WEBHOOK_URL non configuré.');
            return new Response('Internal Server Error: n8n webhook URL missing', { status: 500 });
        }

        console.log('Appel du webhook n8n avec le payload...');
        const n8nResponse = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(n8nPayload),
        });

        if (!n8nResponse.ok) {
            const n8nErrorText = await n8nResponse.text();
            console.error(`Erreur d'appel n8n: ${n8nResponse.status} - ${n8nErrorText}`);
            // Ne pas retourner d'erreur HTTP pour Google Pub/Sub, car il réessayerait
            return new Response('n8n webhook call failed, but notification acknowledged', { status: 200 });
        }

        console.log('Webhook n8n appelé avec succès.');
        return new Response('OK', { status: 200 });

    } catch (error) {
        console.error('Erreur critique dans Edge Function:', error.message);
        // Retourne 200 OK pour Google Pub/Sub même en cas d'erreur interne
        // afin d'éviter des re-déclenchements constants en cas d'erreur non résolue
        return new Response('Internal Server Error, but notification acknowledged', { status: 200 });
    }
});

// --- Utility Functions ---

async function getGmailAccessToken(refreshToken: string): Promise<string | null> {
    const GOOGLE_CLIENT_ID_SERVER = Deno.env.get('GOOGLE_CLIENT_ID_SERVER');
    const GOOGLE_CLIENT_SECRET_SERVER = Deno.env.get('GOOGLE_CLIENT_SECRET_SERVER');

    if (!GOOGLE_CLIENT_ID_SERVER || !GOOGLE_CLIENT_SECRET_SERVER) {
        console.error('Missing Google server environment variables.');
        return null;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID_SERVER,
            client_secret: GOOGLE_CLIENT_SECRET_SERVER,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }).toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error refreshing Gmail access token:', errorText);
        return null;
    }

    const data = await response.json();
    return data.access_token;
}

async function getNewEmails(accessToken: string, emailAddress: string, historyId: string): Promise<{ emails: any[], newHistoryId: string }> {
    const emails: any[] = [];
    let currentHistoryId = historyId;

    try {
        const historyResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/${emailAddress}/history?startHistoryId=${historyId}&historyTypes=messageAdded`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            }
        );

        if (!historyResponse.ok) {
            const errorText = await historyResponse.text();
            console.error('Error fetching Gmail history:', errorText);
            return { emails: [], newHistoryId: historyId };
        }

        const historyData = await historyResponse.json();
        currentHistoryId = historyData.historyId || historyId; // Update history ID

        if (historyData.history) {
            for (const historyRecord of historyData.history) {
                if (historyRecord.messagesAdded) {
                    for (const messageAdded of historyRecord.messagesAdded) {
                        const messageId = messageAdded.message.id;
                        const messageResponse = await fetch(
                            `https://www.googleapis.com/gmail/v1/users/${emailAddress}/messages/${messageId}?format=full`,
                            {
                                headers: { 'Authorization': `Bearer ${accessToken}` },
                            }
                        );

                        if (!messageResponse.ok) {
                            console.error(`Error fetching message ${messageId}:`, await messageResponse.text());
                            continue;
                        }

                        const messageData = await messageResponse.json();
                        const headers = messageData.payload.headers;
                        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
                        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
                        const threadId = messageData.threadId;

                        // Attempt to get the plain text body
                        let body = '';
                        if (messageData.payload.parts) {
                            const part = messageData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                            if (part && part.body && part.body.data) {
                                body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                            }
                        } else if (messageData.payload.body && messageData.payload.body.data) {
                            body = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                        }

                        emails.push({
                            id: messageId,
                            subject: subject,
                            from: from,
                            body: body,
                            thread_id: threadId,
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Critical error in getNewEmails:', error.message);
    }
    return { emails, newHistoryId: currentHistoryId };
}

// async function getContextForCreator(creatorId: string): Promise<any> {
//   // Récupérer les éléments de context_pool_items pour le créateur
//   console.warn("getContextForCreator n'est pas encore implémenté.");
//   return {};
// }