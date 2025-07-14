
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function AddCreatorPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleAddCreator = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('creators').insert([{
        user_id: user.id,
        name,
        email_address: email,
        status: 'onboarding',
        automation_mode: 'assistant',
        gmail_refresh_token: '' // This will be populated by the OAuth callback
      }]);

      if (error) {
        console.error('Error adding creator:', error);
      } else {
        // For simplicity, we'll just redirect to the dashboard.
        // In a real app, you'd initiate the Google OAuth flow here.
        alert('Creator added! Now, you would be redirected to Google to connect your account.');
        navigate('/dashboard');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // The state parameter will be used to pass the manager's user ID to the callback function.
        // This is a placeholder, as the actual implementation is in the Supabase function.
        queryParams: {
          state: 'manager_user_id_placeholder'
        }
      }
    });

    if (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Add New Creator</h1>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Name
          </Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="email" className="text-right">
            Email
          </Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
        </div>
      </div>
      <Button onClick={handleGoogleSignIn} className="w-full">Connect with Google</Button>
    </div>
  );
}

export default AddCreatorPage;
