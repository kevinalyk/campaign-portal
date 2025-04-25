import Image from "next/image"
import Link from "next/link"
import SignUpForm from "@/components/sign-up-form"
import { OrganizationChatbot } from "@/components/organization-chatbot"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-[#192745] p-4">
      {/* Header with login link */}
      <div className="w-full flex justify-end mb-4">
        <Link href="/login" className="text-white/80 text-sm hover:text-white hover:underline transition-colors">
          Login
        </Link>
      </div>

      {/* Logo section */}
      <div className="w-full text-center pt-6 pb-4">
        <div className="mx-auto w-[320px] h-[200px] relative">
          <Image
            src="/images/logo-full.png"
            alt="Campaign Portal Logo"
            width={320}
            height={200}
            className="mx-auto"
            priority
          />
        </div>
      </div>

      {/* Sign-up section */}
      <div className="flex-grow flex items-center justify-center pb-28">
        <div className="max-w-md w-full text-center">
          <p className="text-lg text-white mb-6">Sign up below to be the first to know when we launch.</p>
          <SignUpForm />
        </div>
      </div>

      {/* Only render the chatbot if a valid organizationId is provided */}
      <OrganizationChatbot organizationId="67c796fa5be54c590a823566" />
    </main>
  )
}
