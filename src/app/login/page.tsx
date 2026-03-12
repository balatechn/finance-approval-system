"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/validations/finance-request"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { Lock, Mail } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSSOLoading, setIsSSOLoading] = useState(false)
  
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const error = searchParams.get("error")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginInput) => {
    try {
      setIsLoading(true)
      
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Welcome!",
        description: "You have been successfully logged in.",
        variant: "success",
      })

      router.push(callbackUrl)
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Show error from SSO redirect
  useState(() => {
    if (error === 'NoAccount') {
      toast({
        title: "Account Not Found",
        description: "No account exists for this Microsoft email. Contact your administrator.",
        variant: "destructive",
      })
    } else if (error === 'AccountDeactivated') {
      toast({
        title: "Account Deactivated",
        description: "Your account has been deactivated. Contact your administrator.",
        variant: "destructive",
      })
    }
  })

  const handleMicrosoftSSO = () => {
    setIsSSOLoading(true)
    signIn("azure-ad", { callbackUrl })
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#070B47] via-[#0f1565] to-[#1a1f7a]" />
      
      {/* Floating orbs for depth */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[#2a30a0]/30 blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#4a50c0]/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-[#6366f1]/15 blur-[80px] animate-pulse" style={{ animationDelay: '4s' }} />

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-[440px] mx-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative h-16 w-64">
            <Image
              src="/national-logo.webp"
              alt="National Group India"
              fill
              className="object-contain brightness-0 invert drop-shadow-lg"
              priority
            />
          </div>
        </div>

        {/* Glass card container */}
        <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.15] rounded-3xl p-8 shadow-[0_8px_64px_rgba(0,0,0,0.3)] relative overflow-hidden">
          {/* Inner glass highlight */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.12] to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Finance Approval System
              </h1>
              <p className="text-white/50 text-sm mt-2">
                Sign in to access your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@company.com"
                    {...register("email")}
                    disabled={isLoading}
                    className="pl-11 h-12 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] transition-all duration-300"
                  />
                </div>
                {errors.email?.message && (
                  <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    {...register("password")}
                    disabled={isLoading}
                    className="pl-11 h-12 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] transition-all duration-300"
                  />
                </div>
                {errors.password?.message && (
                  <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl bg-white/[0.15] hover:bg-white/[0.25] text-white font-medium text-sm border border-white/[0.2] backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]" 
                loading={isLoading}
              >
                Sign In
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/[0.1]" />
              <span className="text-white/30 text-xs uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/[0.1]" />
            </div>

            {/* Microsoft 365 SSO */}
            <Button
              type="button"
              onClick={handleMicrosoftSSO}
              disabled={isSSOLoading}
              className="w-full h-12 rounded-xl bg-[#2F2F2F] hover:bg-[#3F3F3F] text-white font-medium text-sm border border-white/[0.1] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
            >
              <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              {isSSOLoading ? "Redirecting..." : "Sign in with Microsoft 365"}
            </Button>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-white/20 text-xs mt-6">
          National Group India &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#070B47]">
        <div className="animate-pulse text-xl text-white/50">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
