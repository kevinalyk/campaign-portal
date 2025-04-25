import { type MongoClient, ObjectId } from "mongodb"
import pdfParse from "pdf-parse/lib/pdf-parse.js"
import mammoth from "mammoth"
import OpenAI from "openai"
import type { Document } from "@/models/Document"

export class DocumentProcessingService {
  private client: MongoClient
  private db: any
  private openai: OpenAI

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async processDocument(documentId: string): Promise<boolean> {
    try {
      const document = await this.db.collection("documents").findOne({ _id: new ObjectId(documentId) })

      if (!document) {
        throw new Error(`Document not found: ${documentId}`)
      }

      await this.db
        .collection("documents")
        .updateOne(
          { _id: new ObjectId(documentId) },
          { $set: { processingStatus: "processing", updatedAt: new Date() } },
        )

      let extractedText: string
      try {
        extractedText = await this.extractTextFromDocument(document)
      } catch (error) {
        console.error(`Error extracting text from document ${documentId}:`, error)
        await this.updateDocumentStatus(documentId, "failed", `Text extraction failed: ${error.message}`)
        return false
      }

      let vectorEmbedding: number[] | null = null
      try {
        if (extractedText.trim()) {
          const truncatedText = this.truncateText(extractedText, 8000)
          vectorEmbedding = await this.generateEmbedding(truncatedText)
        }
      } catch (error) {
        console.error(`Error generating embeddings for document ${documentId}:`, error)
        // Continue even if embedding fails - we can still use the text
      }

      await this.db.collection("documents").updateOne(
        { _id: new ObjectId(documentId) },
        {
          $set: {
            extractedText,
            textProcessed: true,
            vectorEmbedding: vectorEmbedding,
            processingStatus: "completed",
            updatedAt: new Date(),
          },
        },
      )

      return true
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error)
      await this.updateDocumentStatus(documentId, "failed", error.message)
      return false
    }
  }

  private async extractTextFromDocument(document: Document): Promise<string> {
    const fileUrl = document.fileUrl
    const fileType = document.fileType

    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()

    if (fileType.includes("pdf")) {
      return await this.extractPdfText(buffer)
    } else if (fileType.includes("word") || fileType.includes("docx")) {
      return await this.extractWordText(buffer)
    } else if (
      fileType.includes("text") ||
      fileType.includes("plain") ||
      fileType.includes("csv") ||
      fileType.includes("markdown")
    ) {
      return await this.extractPlainText(buffer)
    } else {
      throw new Error(`Unsupported file type: ${fileType}`)
    }
  }

  private async extractPdfText(buffer: ArrayBuffer): Promise<string> {
    try {
      const data = await pdfParse(Buffer.from(buffer))
      return data.text || ""
    } catch (error) {
      console.error("Error parsing PDF:", error)
      throw new Error(`Failed to extract text from PDF: ${error.message}`)
    }
  }

  private async extractWordText(buffer: ArrayBuffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      return result.value || ""
    } catch (error) {
      console.error("Error parsing Word document:", error)
      throw new Error(`Failed to extract text from Word document: ${error.message}`)
    }
  }

  private async extractPlainText(buffer: ArrayBuffer): Promise<string> {
    try {
      const decoder = new TextDecoder("utf-8")
      return decoder.decode(buffer)
    } catch (error) {
      console.error("Error decoding plain text:", error)
      throw new Error(`Failed to extract plain text: ${error.message}`)
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Ensure text is not empty
      if (!text || text.trim() === "") {
        console.warn("Empty text provided to generateEmbedding")
        throw new Error("Text input cannot be empty")
      }

      console.log(`Generating embedding for text: ${text.substring(0, 50)}...`)

      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      })

      if (!response.data || !response.data[0] || !response.data[0].embedding) {
        throw new Error("Invalid embedding response from OpenAI")
      }

      return response.data[0].embedding
    } catch (error) {
      console.error("Error generating embedding:", error)
      throw new Error(`Failed to generate embedding: ${error.message}`)
    }
  }

  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4
    return text.length <= maxChars ? text : text.substring(0, maxChars)
  }

  private async updateDocumentStatus(documentId: string, status: string, error?: string): Promise<void> {
    await this.db.collection("documents").updateOne(
      { _id: new ObjectId(documentId) },
      {
        $set: {
          processingStatus: status,
          processingError: error,
          updatedAt: new Date(),
        },
      },
    )
  }

  async findSimilarDocuments(campaignId: string, query: string, limit = 3): Promise<Document[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query)

      const documents = await this.db
        .collection("documents")
        .find({
          campaignId: new ObjectId(campaignId),
          vectorEmbedding: { $exists: true },
          textProcessed: true,
        })
        .toArray()

      if (documents.length === 0) {
        return this.findDocumentsByKeywords(campaignId, query, limit)
      }

      const documentsWithSimilarity = documents.map((doc) => {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, doc.vectorEmbedding)
        return { ...doc, similarity }
      })

      return documentsWithSimilarity.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
    } catch (error) {
      console.error("Error finding similar documents:", error)
      return this.findDocumentsByKeywords(campaignId, query, limit)
    }
  }

  private async findDocumentsByKeywords(campaignId: string, query: string, limit = 3): Promise<Document[]> {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)

    if (keywords.length === 0) {
      return this.db
        .collection("documents")
        .find({ campaignId: new ObjectId(campaignId), textProcessed: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
    }

    const documents = await this.db
      .collection("documents")
      .find({
        campaignId: new ObjectId(campaignId),
        textProcessed: true,
        extractedText: {
          $regex: keywords.join("|"),
          $options: "i",
        },
      })
      .limit(limit)
      .toArray()

    return documents
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  async getRelevantDocumentContent(campaignId: string, query: string, maxChars = 6000): Promise<string> {
    try {
      const similarDocuments = await this.findSimilarDocuments(campaignId, query, 3)

      if (similarDocuments.length === 0) {
        return ""
      }

      let relevantContent = ""

      for (const doc of similarDocuments) {
        if (doc.extractedText) {
          const contentSample = this.getRelevantTextChunk(doc.extractedText, query, 2000)
          relevantContent += `Document: ${doc.name}\n${contentSample}\n\n`

          if (relevantContent.length >= maxChars) {
            break
          }
        }
      }

      return relevantContent
    } catch (error) {
      console.error("Error getting relevant document content:", error)
      return ""
    }
  }

  private getRelevantTextChunk(text: string, query: string, maxChars: number): string {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 3)

    if (queryTerms.length === 0 || !text) {
      return text.substring(0, maxChars)
    }

    let bestPosition = -1
    let bestTerm = ""

    for (const term of queryTerms) {
      const position = text.toLowerCase().indexOf(term)
      if (position !== -1 && (bestPosition === -1 || position < bestPosition)) {
        bestPosition = position
        bestTerm = term
      }
    }

    if (bestPosition === -1) {
      return text.substring(0, maxChars)
    }

    let startPos = bestPosition
    const contextBefore = 200

    if (startPos > contextBefore) {
      startPos = Math.max(0, startPos - contextBefore)

      const possibleStarts = [
        text.lastIndexOf("\n\n", bestPosition),
        text.lastIndexOf(". ", bestPosition),
        text.lastIndexOf("! ", bestPosition),
        text.lastIndexOf("? ", bestPosition),
      ].filter((pos) => pos !== -1 && pos > startPos)

      if (possibleStarts.length > 0) {
        startPos = Math.max(...possibleStarts) + 2
      }
    }

    return text.substring(startPos, startPos + maxChars)
  }
}
