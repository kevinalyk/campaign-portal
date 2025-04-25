import LoginForm from "@/components/login-form"
import Image from "next/image"
import { Suspense } from "react"

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string }
}) {
  const redirectPath = searchParams.redirect || "/dashboard"

  return (
    <div className="min-h-screen flex flex-col bg-[#192745]">
      {/* Logo section at top */}
      <div className="pt-10 pb-4 flex justify-center">
        <div className="w-[320px] h-[200px] relative">
          <Image
            src="/images/logo-full.png"
            alt="Campaign Portal"
            width={320}
            height={200}
            className="mx-auto"
            priority
          />
        </div>
      </div>

      {/* Login form in middle section with extra bottom padding to push it up */}
      <div className="flex-grow flex items-center justify-center pb-28">
        <div className="max-w-md w-full px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<div>Loading...</div>}>
            <LoginForm redirectPath={redirectPath} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
