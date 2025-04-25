"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check } from "lucide-react"

interface EmbedCodeGeneratorProps {
  campaignId: string
}

export function EmbedCodeGenerator({ campaignId }: EmbedCodeGeneratorProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("iframe")
  const [scriptUrl, setScriptUrl] = useState("")

  useEffect(() => {
    // Get the current domain
    const domain = window.location.origin
    setScriptUrl(`${domain}/api/embed-script`)
  }, [])

  const iframeCode = `<iframe 
  src="${window.location.origin}/embed/chatbot?campaignId=${campaignId}" 
  width="100%" 
  height="600px" 
  style="border: none; max-width: 400px;" 
  allow="clipboard-write"
></iframe>`

  const scriptCode = `<script src="${scriptUrl}"></script>
<div id="campaign-chatbot" data-campaign-id="${campaignId}"></div>`

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (err) => {
        // Could not copy text
      },
    )
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="iframe" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="iframe">iFrame Embed</TabsTrigger>
          <TabsTrigger value="script">Script Embed</TabsTrigger>
        </TabsList>
        <TabsContent value="iframe" className="space-y-4">
          <p className="text-sm text-gray-600">
            Use this iframe code to embed the chatbot directly on your website. This is the simplest method.
          </p>
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">{iframeCode}</pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(iframeCode)}
                >
                  {copied && activeTab === "iframe" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="script" className="space-y-4">
          <p className="text-sm text-gray-600">
            Use this script code for a more advanced integration. The chatbot will be loaded dynamically.
          </p>
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">{scriptCode}</pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(scriptCode)}
                >
                  {copied && activeTab === "script" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 p-4 bg-blue-50 rounded-md text-sm text-blue-700">
        <h4 className="font-medium mb-2">Embedding Tips:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>The chatbot will automatically use your organization's color and settings.</li>
          <li>You can place the embed code anywhere on your website where you want the chatbot to appear.</li>
          <li>For the iframe method, you can adjust the width and height attributes as needed.</li>
          <li>The script method creates a floating chat button in the bottom-right corner of your website.</li>
        </ul>
      </div>
    </div>
  )
}
