"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, FileSpreadsheet, Download, Copy, CheckCircle } from "lucide-react"
import { convertExcelToLiquibase, downloadTemplate } from "@/lib/excel-converter"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"

export default function ExcelToLiquibaseConverter() {
  const [xmlOutput, setXmlOutput] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [authorName, setAuthorName] = useState("thant htoo aung")
  const [processedSheets, setProcessedSheets] = useState<string[]>([])
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [processAllSheets, setProcessAllSheets] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError("")
    setProcessedSheets([])

    try {
      // First, just get the sheet names
      const sheets = await getExcelSheetNames(file)
      setAvailableSheets(sheets)
      setSelectedSheets(sheets)

      // Then process the file
      const result = await convertExcelToLiquibase(file, authorName, processAllSheets ? sheets : selectedSheets)
      setXmlOutput(result.xml)
      setProcessedSheets(result.processedSheets)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setXmlOutput("")
    } finally {
      setLoading(false)
    }
  }

  const getExcelSheetNames = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: "array" })
          resolve(workbook.SheetNames)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => {
        reject(new Error("Error reading the Excel file"))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(xmlOutput)
  }

  const downloadXml = () => {
    const blob = new Blob([xmlOutput], { type: "text/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "liquibase-changeset.xml"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSheetSelection = (sheet: string, checked: boolean) => {
    if (checked) {
      setSelectedSheets((prev) => [...prev, sheet])
    } else {
      setSelectedSheets((prev) => prev.filter((s) => s !== sheet))
    }
  }

  const handleProcessAllSheetsChange = (checked: boolean) => {
    setProcessAllSheets(checked)
    if (checked) {
      setSelectedSheets(availableSheets)
    }
  }

  const processFile = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError("")
    setProcessedSheets([])

    try {
      const result = await convertExcelToLiquibase(
        fileInputRef.current.files[0],
        authorName,
        processAllSheets ? availableSheets : selectedSheets,
      )
      setXmlOutput(result.xml)
      setProcessedSheets(result.processedSheets)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setXmlOutput("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Excel to Liquibase XML Converter</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set your preferences for the Liquibase XML generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="authorName">Author Name</Label>
                <Input
                  id="authorName"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Enter author name"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>Upload an Excel file with code values to convert to Liquibase XML format</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="mb-4 text-sm text-muted-foreground">
                Drag and drop your Excel file here, or click to browse
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                {loading ? "Processing..." : "Select Excel File"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {availableSheets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sheet Selection</CardTitle>
              <CardDescription>Select which sheets to process from your Excel file</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="processAllSheets"
                    checked={processAllSheets}
                    onCheckedChange={handleProcessAllSheetsChange}
                  />
                  <Label htmlFor="processAllSheets">Process all sheets</Label>
                </div>

                {!processAllSheets && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {availableSheets.map((sheet) => (
                      <div key={sheet} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sheet-${sheet}`}
                          checked={selectedSheets.includes(sheet)}
                          onCheckedChange={(checked) => handleSheetSelection(sheet, checked === true)}
                        />
                        <Label htmlFor={`sheet-${sheet}`}>{sheet}</Label>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={processFile} disabled={loading || selectedSheets.length === 0}>
                  {loading ? "Processing..." : "Process Selected Sheets"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {processedSheets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Processed Sheets</CardTitle>
              <CardDescription>The following sheets were successfully processed</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {processedSheets.map((sheet) => (
                  <li key={sheet} className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    {sheet}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {xmlOutput && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Liquibase XML Output</CardTitle>
                <CardDescription>Generated Liquibase XML changeset from your Excel data</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button size="sm" onClick={downloadXml}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={xmlOutput} readOnly className="font-mono text-sm h-96" />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p>Your Excel file should follow this structure for each sheet:</p>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  First row: <code>CodeName</code> in column A and the actual code name (e.g., &quot;RELATIONSHIP&quot;) in column
                  B
                </li>
                <li>
                  Second row: Column headers (<code>code_value</code>, <code>code_description</code>,{" "}
                  <code>code_value_mm</code>)
                </li>
                <li>Subsequent rows: The actual code values to be inserted</li>
              </ul>
              <p>The tool will generate a Liquibase XML changeset for each sheet in your Excel file.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
