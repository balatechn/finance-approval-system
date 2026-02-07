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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const {
    register,
    handleSubmit,
    setValue,
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">Finance Approval System</CardTitle>
          <CardDescription>
            Enter your credentials to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" required>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@company.com"
                {...register("email")}
                error={errors.email?.message}
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" required>Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register("password")}
                error={errors.password?.message}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" loading={isLoading}>
              Sign In
            </Button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="text-sm text-muted-foreground text-center mb-3">
              Demo Accounts (Password: Password@123)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted p-2 cursor-pointer hover:bg-muted/80" onClick={() => { setValue("email", "employee@nationalconsultingindia.com"); setValue("password", "Password@123"); }}>
                <p className="font-medium">Employee</p>
                <p className="text-muted-foreground text-[10px]">employee@national...</p>
              </div>
              <div className="rounded bg-muted p-2 cursor-pointer hover:bg-muted/80" onClick={() => { setValue("email", "finance@nationalconsultingindia.com"); setValue("password", "Password@123"); }}>
                <p className="font-medium">Finance Team</p>
                <p className="text-muted-foreground text-[10px]">finance@national...</p>
              </div>
              <div className="rounded bg-muted p-2 cursor-pointer hover:bg-muted/80" onClick={() => { setValue("email", "fc@nationalconsultingindia.com"); setValue("password", "Password@123"); }}>
                <p className="font-medium">Finance Controller</p>
                <p className="text-muted-foreground text-[10px]">fc@national...</p>
              </div>
              <div className="rounded bg-muted p-2 cursor-pointer hover:bg-muted/80" onClick={() => { setValue("email", "director@nationalconsultingindia.com"); setValue("password", "Password@123"); }}>
                <p className="font-medium">Director</p>
                <p className="text-muted-foreground text-[10px]">director@national...</p>
              </div>
              <div className="rounded bg-muted p-2 cursor-pointer hover:bg-muted/80" onClick={() => { setValue("email", "md@nationalconsultingindia.com"); setValue("password", "Password@123"); }}>
                <p className="font-medium">MD</p>
                <p className="text-muted-foreground text-[10px]">md@national...</p>
              </div>
              <div className="rounded bg-muted p-2 cursor-pointer hover:bg-muted/80" onClick={() => { setValue("email", "bala@nationalgroupindia.com"); setValue("password", "Password@123"); }}>
                <p className="font-medium">Admin</p>
                <p className="text-muted-foreground text-[10px]">bala@nationalgroup...</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-pulse text-xl text-gray-500">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
