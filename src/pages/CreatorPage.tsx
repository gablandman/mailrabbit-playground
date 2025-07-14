
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Creator {
  id: string;
  name: string;
  email_address: string;
  status: 'onboarding' | 'active' | 'inactive' | 'paused';
  automation_mode: 'assistant' | 'agent';
  preferred_template_id: string | null;
}

function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCreator = async () => {
      if (id) {
        const { data, error } = await supabase
          .from('creators')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching creator:', error);
        } else {
          setCreator(data as Creator);
        }
      }
      setLoading(false);
    };

    fetchCreator();
  }, [id]);

  const handleUpdate = async () => {
    if (creator) {
      const { error } = await supabase
        .from('creators')
        .update(creator)
        .eq('id', creator.id);

      if (error) {
        console.error('Error updating creator:', error);
      } else {
        alert('Creator updated successfully!');
      }
    }
  };

  const handleDelete = async () => {
    if (creator) {
      const { error } = await supabase
        .from('creators')
        .delete()
        .eq('id', creator.id);

      if (error) {
        console.error('Error deleting creator:', error);
      } else {
        alert('Creator deleted successfully!');
        navigate('/dashboard');
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!creator) {
    return <div>Creator not found.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{creator.name}</h1>
        <Button onClick={handleUpdate}>Save Changes</Button>
      </div>
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>
        <TabsContent value="settings">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" value={creator.name} onChange={(e) => setCreator({ ...creator, name: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={creator.status} onValueChange={(value) => setCreator({ ...creator, status: value as Creator['status'] })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="automation-mode" className="text-right">
                Automation Mode
              </Label>
              <div className="flex items-center space-x-2">
                <Switch id="automation-mode" checked={creator.automation_mode === 'agent'} onCheckedChange={(checked) => setCreator({ ...creator, automation_mode: checked ? 'agent' : 'assistant' })} />
                <span>{creator.automation_mode === 'agent' ? 'Agent' : 'Assistant'}</span>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="templates">
          <p>Template management coming soon.</p>
        </TabsContent>
        <TabsContent value="danger">
          <div className="py-4">
            <h3 className="text-lg font-semibold text-destructive">Delete Creator</h3>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="mt-4">Delete</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you sure?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete the creator and all associated data.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CreatorPage;
