import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Importez votre client Supabase
import { Button } from '@/components/ui/button'; // Exemple de composant Shadcn Button
import { Input } from '@/components/ui/input'; // Exemple de composant Shadcn Input
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Pour une meilleure présentation

export default function AuthTestPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null); // Pour stocker la session utilisateur

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Destructurez la `data` pour accéder à la `subscription`
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      // Appelez unsubscribe sur l'objet subscription directement
      authListener?.unsubscribe();
    };
  }, []);

  // --- Fonctions d'authentification standard (Email/Password) ---
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Check your email for the confirmation link!');
    setLoading(false);
  };

  // --- Authentification Google OAuth (pour le MANAGER de l'APP) ---
  // CE BOUTON SERT À CONNECTER L'UTILISATEUR (MANAGER) À VOTRE APP VIA GOOGLE.
  // Ce n'est PAS pour ajouter un créateur.
  const handleManagerGoogleSignIn = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`, // L'URI de callback de Supabase
      },
    });

    if (error) {
      alert(`Error signing in with Google: ${error.message}`);
      setLoading(false);
    }
  };

  // --- Fonction pour Connecter un Compte Gmail de CRÉATEUR ---
  const handleCreatorGmailConnect = () => {
    // Les scopes nécessaires pour Gmail API
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify');

    // L'ID Client de Google Cloud pour le flux créateur (celui configuré pour l'Edge Function callback)
    // Il faudrait stocker cela dans une variable d'environnement frontend si c'est différent de SUPABASE_GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_ID_CREATOR_FRONTEND = '1000977490486-jb1sp3rhjpjqdug3229u3aed01mrjq5l.apps.googleusercontent.com'; // REMPLACER CECI

    // L'URL de redirection doit être l'URL PUBLIQUE de votre Edge Function handle-gmail-oauth-callback
    const REDIRECT_URI_CREATOR = "https://unhfmfiyzxugmljlzbwk.supabase.co/functions/v1/handle-gmail-oauth-callback"; // REMPLACER CECI

    // Construire l'URL d'autorisation Google OAuth
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `scope=${scopes}&` +
      `access_type=offline&` + // Très important pour obtenir un refresh_token
      `include_granted_scopes=true&` +
      `response_type=code&` +
      `state=${session?.user.id || 'anonymous'}&` + // Optionnel: pour passer l'ID du manager
      `redirect_uri=${encodeURIComponent(REDIRECT_URI_CREATOR)}&` +
      `client_id=${GOOGLE_CLIENT_ID_CREATOR_FRONTEND}`;

    // Rediriger le navigateur vers l'URL d'autorisation Google
    window.location.href = authUrl;
  };

  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
    setLoading(false);
  };

  // --- Rendu de l'interface ---
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-6 space-y-6">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">FireName App</CardTitle>
          <CardDescription>Testez l'authentification ici</CardDescription>
        </CardHeader>
        <CardContent>
          {session ? (
            <div className="text-center space-y-4">
              <p className="text-lg">Bienvenue, {session.user.email}!</p>
              <p className="text-sm text-gray-600">User ID: {session.user.id}</p>
              <Button onClick={handleSignOut} disabled={loading} className="w-full">
                {loading ? 'Déconnexion...' : 'Se déconnecter'}
              </Button>

              <hr className="my-6" />

              <h3 className="text-xl font-semibold mb-4">Ajouter un créateur (Test Gmail OAuth)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Cliquez sur le bouton ci-dessous pour connecter une boîte Gmail pour un créateur.
                Cela déclenchera le flux OAuth de Google et, en arrière-plan, la fonction `users.watch()`
                qui abonne cette boîte aux notifications Pub/Sub.
              </p>
              {/* Le bouton pour le flux du créateur */}
              <Button onClick={handleCreatorGmailConnect} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? 'Connexion Gmail Créateur...' : 'Connecter un compte Gmail de Créateur'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-center mb-4">Connexion / Inscription</h2>
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Votre Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Votre Mot de Passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Connexion...' : 'Se connecter (Email/MDP)'}
                </Button>
              </form>
              <Button onClick={handleEmailSignUp} disabled={loading} variant="outline" className="w-full mt-2">
                {loading ? 'Inscription...' : 'S\'inscrire (Email/MDP)'}
              </Button>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Ou</span>
                </div>
              </div>
              {/* Le bouton pour l'authentification du MANAGER de l'app */}
              <Button onClick={handleManagerGoogleSignIn} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? 'Connexion Google...' : 'Se connecter avec Google (Manager)'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}