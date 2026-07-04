import React from "react";
import { Lock, ArrowLeft, Mail, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 font-['Poppins']"
      style={{ 
        background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)",
        color: "#1F2A37"
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden relative">
        {/* Subtle decorative background element */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-gray-50 rounded-full opacity-50 blur-xl pointer-events-none"></div>

        <div className="p-8 relative z-10">
          <a href="#" className="inline-flex items-center text-sm font-medium mb-8 hover:opacity-80 transition-opacity" style={{ color: "#6F8FA3" }}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to sign in
          </a>

          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#2E3C48" }}
              >
                <Lock className="w-5 h-5" style={{ color: "#E8DCC4" }} />
              </div>
              <span className="text-xl font-bold tracking-tight" style={{ color: "#2E3C48" }}>
                Mystery Unlock
              </span>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <div className="relative">
                <Lock className="w-6 h-6 text-blue-500" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-400 rounded-full animate-ping"></div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
            <p className="text-sm text-gray-500">Enter your email and we'll send a reset code</p>
          </div>

          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m.scott@dundermifflin.com"
                  className="pl-9 focus-visible:ring-[#6F8FA3] border-gray-200"
                />
              </div>
            </div>

            <Button 
              className="w-full font-semibold h-11"
              style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
            >
              Send Reset Code
            </Button>
          </form>

          <div className="mt-6 p-4 rounded-lg bg-gray-50 border border-gray-100 flex gap-3 items-start">
            <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-500 leading-relaxed">
              Check your spam folder if you don't see the email within 2 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
