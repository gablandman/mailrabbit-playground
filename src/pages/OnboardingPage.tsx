import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-2xl p-6 space-y-6 rounded-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-extrabold text-center text-gray-900">Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-center">Step 1: Organization Details</h2>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input id="orgName" placeholder="Your Organization Name" />
                </div>
                <div>
                  <Label htmlFor="orgSize">Organization Size</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201+">201+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-center">Step 2: Plan Selection</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                <Card className="p-4">
                  <CardHeader>
                    <CardTitle>Free</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>$0/month</p>
                    <Button className="mt-4 w-full">Select Plan</Button>
                  </CardContent>
                </Card>
                <Card className="p-4 border-blue-500 border-2">
                  <CardHeader>
                    <CardTitle>Pro</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>$99/month</p>
                    <Button className="mt-4 w-full">Select Plan</Button>
                  </CardContent>
                </Card>
                <Card className="p-4">
                  <CardHeader>
                    <CardTitle>Enterprise</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Contact us</p>
                    <Button className="mt-4 w-full">Contact Us</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          <div className="flex justify-between mt-6">
            {step > 1 && (
              <Button onClick={() => setStep(step - 1)}>Previous</Button>
            )}
            {step < 2 && (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            )}
            {step === 2 && (
              <Button>Finish</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}