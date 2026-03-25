import { LoginForm } from "@/components/layout/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">YARDA</h1>
          <p className="mt-1 text-sm text-gray-500">FX Risk Management</p>
        </div>
        <div className="bg-white rounded-xl border p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in</h2>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-gray-900 font-medium hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
