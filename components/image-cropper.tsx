"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, ZoomIn, ZoomOut, Check, X } from "lucide-react"

interface ImageCropperProps {
  onCrop: (croppedImage: string) => void
  onCancel: () => void
  circular?: boolean
}

export function ImageCropper({ onCrop, onCancel, circular = true }: ImageCropperProps) {
  const [image, setImage] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isCropping, setIsCropping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageDataUrl = event.target?.result as string
        setImage(imageDataUrl)

        // Load the image to get its dimensions
        const img = new Image()
        img.onload = () => {
          setImageSize({ width: img.width, height: img.height })
        }
        img.src = imageDataUrl

        // Reset position and scale when new image is loaded
        setPosition({ x: 0, y: 0 })
        setScale(1)
        setError(null)
      }
      reader.onerror = () => {
        setError("Error reading file. Please try another image.")
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageRef.current && containerRef.current) {
      e.preventDefault()
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // Calculate boundaries to keep the image within the crop area
      const containerRect = containerRef.current.getBoundingClientRect()
      const imageRect = imageRef.current.getBoundingClientRect()

      const minX = containerRect.width - imageRect.width * scale
      const minY = containerRect.height - imageRect.height * scale

      setPosition({
        x: Math.min(0, Math.max(newX, minX)),
        y: Math.min(0, Math.max(newY, minY)),
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleCrop = () => {
    if (!image || !containerRef.current || !imageRef.current) {
      setError("No image to crop")
      return
    }

    setIsCropping(true)
    setError(null)

    try {
      // Create a temporary image to get the original dimensions
      const tempImg = new Image()
      tempImg.onload = () => {
        try {
          const containerRect = containerRef.current!.getBoundingClientRect()
          const containerWidth = containerRect.width
          const containerHeight = containerRect.height

          // Calculate the visible portion of the image
          // These calculations convert from screen coordinates to image coordinates
          const sourceX = (-position.x / scale) * (tempImg.width / imageRef.current!.offsetWidth)
          const sourceY = (-position.y / scale) * (tempImg.height / imageRef.current!.offsetHeight)
          const sourceWidth = (containerWidth / scale) * (tempImg.width / imageRef.current!.offsetWidth)
          const sourceHeight = (containerHeight / scale) * (tempImg.height / imageRef.current!.offsetHeight)

          // Create the main canvas for cropping
          const canvas = document.createElement("canvas")
          canvas.width = containerWidth
          canvas.height = containerHeight
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            setError("Could not create canvas context")
            setIsCropping(false)
            return
          }

          // Draw the cropped portion of the image
          ctx.drawImage(tempImg, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, containerWidth, containerHeight)

          // If circular cropping is enabled, create a second canvas with a circular mask
          if (circular) {
            const circularCanvas = document.createElement("canvas")
            circularCanvas.width = containerWidth
            circularCanvas.height = containerHeight
            const circularCtx = circularCanvas.getContext("2d")

            if (circularCtx) {
              // Create circular clipping path
              circularCtx.beginPath()
              circularCtx.arc(
                containerWidth / 2,
                containerHeight / 2,
                Math.min(containerWidth, containerHeight) / 2,
                0,
                Math.PI * 2,
              )
              circularCtx.closePath()
              circularCtx.clip()

              // Draw the first canvas onto the circular canvas
              circularCtx.drawImage(canvas, 0, 0)

              // Get the final cropped image
              const croppedImage = circularCanvas.toDataURL("image/png")
              onCrop(croppedImage)
            } else {
              // Fallback if circular context fails
              const croppedImage = canvas.toDataURL("image/png")
              onCrop(croppedImage)
            }
          } else {
            // For non-circular crops, just use the first canvas
            const croppedImage = canvas.toDataURL("image/png")
            onCrop(croppedImage)
          }
        } catch (err) {
          console.error("Error drawing image:", err)
          setError("Error creating cropped image")
        } finally {
          setIsCropping(false)
        }
      }

      tempImg.onerror = () => {
        setError("Error loading image for cropping")
        setIsCropping(false)
      }

      tempImg.src = image
    } catch (err) {
      console.error("General cropping error:", err)
      setError("An unexpected error occurred")
      setIsCropping(false)
    }
  }

  // Add event listeners for mouse events outside the component
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && imageRef.current && containerRef.current) {
        const newX = e.clientX - dragStart.x
        const newY = e.clientY - dragStart.y

        // Calculate boundaries
        const containerRect = containerRef.current.getBoundingClientRect()
        const imageRect = imageRef.current.getBoundingClientRect()

        const minX = containerRect.width - imageRect.width * scale
        const minY = containerRect.height - imageRect.height * scale

        setPosition({
          x: Math.min(0, Math.max(newX, minX)),
          y: Math.min(0, Math.max(newY, minY)),
        })
      }
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove)
      window.addEventListener("mouseup", handleGlobalMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove)
      window.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [isDragging, dragStart, scale])

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-white rounded-lg border">
      <div className="w-full flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Crop Image</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && <div className="w-full p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      {!image ? (
        <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg p-4">
          <Upload className="h-10 w-10 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 mb-4">Upload an image to crop</p>
          <Button onClick={() => fileInputRef.current?.click()}>Select Image</Button>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className={`relative w-64 h-64 overflow-hidden border ${circular ? "rounded-full" : "rounded-md"}`}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={image || "/placeholder.svg"}
              alt="Crop preview"
              className="absolute"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                left: `${position.x}px`,
                top: `${position.y}px`,
              }}
              draggable="false"
            />
          </div>

          <div className="w-full max-w-xs flex items-center space-x-2">
            <ZoomOut className="h-4 w-4 text-gray-500" />
            <Slider
              value={[scale]}
              min={0.5}
              max={3}
              step={0.01}
              onValueChange={(value) => setScale(value[0])}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-gray-500" />
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleCrop} disabled={isCropping}>
              {isCropping ? (
                "Processing..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Apply
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
