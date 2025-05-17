import * as XLSX from "xlsx"

interface CodeValue {
  code_value: string
  code_description: string
  code_value_mm: string
}

interface ConversionResult {
  xml: string
  processedSheets: string[]
}

export async function convertExcelToLiquibase(
  file: File,
  authorName = "thant htoo aung",
  sheetsToProcess: string[] = [],
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })

        const sheetNames = sheetsToProcess.length > 0 ? sheetsToProcess : workbook.SheetNames

        let combinedXml = `<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
                   https://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.4.xsd">
`

        const processedSheets: string[] = []

        for (const sheetName of sheetNames) {
          try {
            const worksheet = workbook.Sheets[sheetName]

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            if (jsonData.length < 3) {
              console.warn(`Skipping sheet ${sheetName}: Not enough rows`)
              continue
            }

            const codeName = jsonData[0][1]
            if (!codeName) {
              console.warn(`Skipping sheet ${sheetName}: CodeName not found in cell B1`)
              continue
            }

            const headers = jsonData[1]
            const expectedHeaders = ["code_value", "code_description", "code_value_mm"]

            const headerIndexes: Record<string, number> = {}
            for (let i = 0; i < headers.length; i++) {
              const header = headers[i]?.toString().trim()
              if (expectedHeaders.includes(header)) {
                headerIndexes[header] = i
              }
            }

            let missingHeaders = false
            for (const header of expectedHeaders) {
              if (headerIndexes[header] === undefined) {
                console.warn(`Skipping sheet ${sheetName}: Required header "${header}" not found`)
                missingHeaders = true
                break
              }
            }

            if (missingHeaders) continue

            const dataRows: CodeValue[] = []
            for (let i = 2; i < jsonData.length; i++) {
              const row = jsonData[i]
              if (row && row.some((cell) => cell !== undefined && cell !== null && cell !== "")) {
                const codeValue: CodeValue = {
                  code_value: row[headerIndexes["code_value"]]?.toString() || "",
                  code_description: row[headerIndexes["code_description"]]?.toString() || "",
                  code_value_mm: row[headerIndexes["code_value_mm"]]?.toString() || "",
                }
                dataRows.push(codeValue)
              }
            }

            if (dataRows.length === 0) {
              console.warn(`Skipping sheet ${sheetName}: No data rows found`)
              continue
            }

            const sheetXml = generateLiquibaseXmlForSheet(codeName, dataRows, authorName)
            combinedXml += sheetXml
            processedSheets.push(sheetName)
          } catch (error) {
            console.error(`Error processing sheet ${sheetName}:`, error)
          }
        }

        combinedXml += `</databaseChangeLog>`

        if (processedSheets.length === 0) {
          reject(new Error("No valid sheets found in the Excel file"))
        } else {
          resolve({
            xml: combinedXml,
            processedSheets,
          })
        }
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

function generateLiquibaseXmlForSheet(codeName: string, dataRows: CodeValue[], authorName: string): string {
  const changeSetId = `001_insert_${codeName.toLowerCase()}_data`

  let xml = `
    <!-- Insert ${codeName} Data -->
    <changeSet id="${changeSetId}" author="${escapeXml(authorName)}">`

  dataRows.forEach((row) => {
    xml += `
        <insert tableName="m_code_value">
            <column name="code_id" valueComputed="(SELECT id FROM m_code WHERE code_name = '${escapeXml(codeName)}')"/>
            <column name="code_value" value="${escapeXml(row.code_value)}"/>
            <column name="code_description" value="${escapeXml(row.code_description)}"/>
            <column name="code_value_mm" value="${escapeXml(row.code_value_mm)}"/>
        </insert>`
  })

  xml += `
    </changeSet>
`

  return xml
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return ""
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function downloadTemplate() {
  const workbook = XLSX.utils.book_new()

  const templateData = [
    ["CodeName", "YOUR_CODE_NAME_HERE"],
    ["code_value", "code_description", "code_value_mm"],
    ["example_value", "Example Description", "Example Value (Myanmar)"], // Row 3: Example data
    ["", "", ""],
    ["", "", ""],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(templateData)

  const colWidths = [
    { wch: 15 }, // A
    { wch: 25 }, // B
    { wch: 25 }, // C
  ]

  worksheet["!cols"] = colWidths

  XLSX.utils.book_append_sheet(workbook, worksheet, "Template")

  const exampleSheets = [
    {
      name: "Gender",
      values: [
        ["Male", "Male Gender", "ကျား"],
        ["Female", "Female Gender", "မ"],
      ],
    },
    {
      name: "RELATIONSHIP",
      values: [
        ["Father", "Father Relation", "ဖခင်"],
        ["Mother", "Mother Relation", "မိခင်"],
      ],
    },
    {
      name: "ClientType",
      values: [
        ["Test", "Test Desc", "စမ်းသပ်မှု"],
      ],
    },
    {
      name: "ClientClassification",
      values: [
        ["Test", "Test Desc", "စမ်းသပ်မှု"],
      ],
    },
  ]

  exampleSheets.forEach((sheet) => {
    const sheetData = [
      ["CodeName", sheet.name],
      ["code_value", "code_description", "code_value_mm"],
      ...sheet.values,
    ]

    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws["!cols"] = colWidths
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name)
  })

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "binary" })

  const buf = new ArrayBuffer(wbout.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < wbout.length; i++) {
    view[i] = wbout.charCodeAt(i) & 0xff
  }
  const blob = new Blob([buf], { type: "application/octet-stream" })

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "liquibase_template.xlsx"
  document.body.appendChild(a)
  a.click()

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 0)
}
