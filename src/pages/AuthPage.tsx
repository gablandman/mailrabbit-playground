import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for the password reset link!');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      // Inscription du manager
      const { data, error } = await supabase.auth.signUp({ email, password });
      console.log('SignUp Data:', data);
      if (error) {
        alert(error.message);
      } else {
        alert('Vérifiez votre e-mail pour le lien de confirmation !');
        setIsSignUp(false); // Après l'inscription, revenir au mode connexion
      }
    } else {
      // Connexion du manager
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('SignIn Data:', data);
      if (error) {
        alert(error.message);
      } else {
        // Si la connexion réussit, rediriger explicitement vers le tableau de bord
        // Le listener dans App.tsx devrait aussi le faire, mais c'est plus direct.
        if (data.user) { // Vérifier que l'utilisateur est bien connecté
          navigate('/dashboard');
        } else {
          // Cas où l'authentification est "réussie" mais l'utilisateur n'est pas encore confirmé par exemple
          alert("Connexion réussie, mais l'utilisateur n'est pas encore actif. Vérifiez votre email si nécessaire.");
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-6 space-y-6 rounded-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold text-gray-900">Bienvenue sur FireName</CardTitle>
          <CardDescription className="text-gray-600">
            {forgotPassword
              ? 'Reset your password'
              : isSignUp
              ? 'Créez votre compte manager'
              : 'Connectez-vous à votre compte manager'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <Input
                  id="email"
                  type="email"
                  placeholder="Votre Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  id="email"
                  type="email"
                  placeholder="Votre Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Votre Mot de Passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">
                {loading ? (isSignUp ? 'Inscription...' : 'Connexion...') : isSignUp ? "S'inscrire" : 'Se connecter'}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm text-gray-600">
            {forgotPassword ? (
              <Button variant="link" onClick={() => setForgotPassword(false)} className="p-0 h-auto text-blue-600 hover:underline">
                Back to login
              </Button>
            ) : (
              <>
                {isSignUp ? (
                  <>
                    Vous avez déjà un compte ?{' '}
                    <Button variant="link" onClick={() => setIsSignUp(false)} className="p-0 h-auto text-blue-600 hover:underline">
                      Connectez-vous
                    </Button>
                  </>
                ) : (
                  <>
                    Pas encore de compte ?{' '}
                    <Button variant="link" onClick={() => setIsSignUp(true)} className="p-0 h-auto text-blue-600 hover:underline">
                      Inscrivez-vous
                    </Button>
                    <span className="mx-2">|</span>
                    <Button variant="link" onClick={() => setForgotPassword(true)} className="p-0 h-auto text-blue-600 hover:underline">
                      Forgot Password?
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
