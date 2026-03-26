import { SignupForm } from "@/components/layout/signup-form"

export default function SignupPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">YARDA</h1>
          <p className="mt-1 text-sm text-gray-500">FX Risk Management</p>
        </div>
        <div className="bg-white rounded-xl border p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Create account</h2>
          <SignupForm />
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a href="/login" className="text-gray-900 font-medium hover:underline">
            Sign in
          </a>
        </p>
      </div>
      <p className="mt-8 text-xs text-gray-400">
        MVP by{" "}
        <a
          href="https://nandann.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
        >
          Nandann Creative
        </a>
      </p>
    </div>
  )
}
