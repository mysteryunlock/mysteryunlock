import React, { useState } from "react";
import { Eye, EyeOff, Store, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const getStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    if (pass.length < 6) return 1;
    if (pass.length < 10) return 2;
    return 3;
  };

  const strength = getStrength(password);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 font-['Poppins']"
      style={{ 
        background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)",
        color: "#1F2A37"
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden my-8">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <img src="/__mockup/images/logo.png" alt="Mystery Unlock" className="h-12 w-auto object-contain" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Create your account</h1>
            <p className="text-sm text-gray-500">Launch your first prize wheel in minutes</p>
          </div>

          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop name</Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  id="shopName" 
                  placeholder="Acme Store"
                  className="pl-9 focus-visible:ring-[#6F8FA3] border-gray-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopUrl">Shop URL</Label>
              <Input 
                id="shopUrl" 
                placeholder="acmestore"
                className="focus-visible:ring-[#6F8FA3] border-gray-200"
              />
              <p className="text-xs text-gray-400">mysteryunlock.com/acmestore</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 focus-visible:ring-[#6F8FA3] border-gray-200"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="flex gap-1 mt-2">
                {[1, 2, 3].map((level) => (
                  <div 
                    key={level} 
                    className="h-1 flex-1 rounded-full transition-colors duration-300"
                    style={{ 
                      backgroundColor: strength >= level 
                        ? (strength === 1 ? '#EF4444' : strength === 2 ? '#EAB308' : '#10B981') 
                        : '#E5E7EB' 
                    }}
                  />
                ))}
              </div>
            </div>

            <Button 
              className="w-full font-semibold h-11 mt-6"
              style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-8 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full h-11 border-gray-200 hover:bg-gray-50 font-medium">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign up with Google
          </Button>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="#" className="font-medium hover:underline" style={{ color: "#2E3C48" }}>
              Sign in
            </a>
          </p>
          
          <p className="mt-4 text-center text-xs text-gray-400 max-w-[280px] mx-auto">
            By creating an account, you agree to our Terms & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
