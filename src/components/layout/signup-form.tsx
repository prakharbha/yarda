"use client"

import { useActionState } from "react"
import { signUpAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, undefined)

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" placeholder="Alexia Ramos" required />
        {state?.errors?.name && (
          <p className="text-xs text-red-600">{state.errors.name[0]}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="organizationName">Company name</Label>
        <Input id="organizationName" name="organizationName" placeholder="Acme Corp" required />
        {state?.errors?.organizationName && (
          <p className="text-xs text-red-600">{state.errors.organizationName[0]}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" placeholder="you@company.com" required />
        {state?.errors?.email && (
          <p className="text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
        {state?.errors?.password && (
          <p className="text-xs text-red-600">{state.errors.password[0]}</p>
        )}
      </div>
      {state?.message && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
