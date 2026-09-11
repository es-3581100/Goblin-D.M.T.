export const LEDGER_STATUSES = [
  "complete",
  "partial",
  "blocked",
  "not_started",
  "unknown"
] as const

export type LedgerStatus = typeof LEDGER_STATUSES[number]

export interface LedgerConsistencyResult {
  applicable: boolean
  ok: boolean
  declared: Record<LedgerStatus, number>
  observed: Record<LedgerStatus, number>
  declaredTotal?: number
  observedTotal: number
  mismatches: string[]
}

function zeroCounts(): Record<LedgerStatus, number> {
  return {
    complete: 0,
    partial: 0,
    blocked: 0,
    not_started: 0,
    unknown: 0
  }
}

function splitMarkdownRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith("|")) text = text.slice(1)
  if (text.endsWith("|")) text = text.slice(0, -1)

  const cells: string[] = []
  let current = ""
  let escaped = false

  for (const ch of text) {
    if (escaped) {
      current += ch
      escaped = false
      continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (ch === "|") {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  if (escaped) current += "\\"
  cells.push(current.trim())
  return cells
}

function isSeparatorRow(line: string): boolean {
  const cells = splitMarkdownRow(line)
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()))
}

function section(markdown: string, heading: string): string[] | undefined {
  const lines = markdown.split(/\r?\n/)
  const wanted = heading.trim().toLowerCase()

  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{2,6})\s+(.+?)\s*$/.exec(lines[i].trim())
    if (!match) continue
    if (match[2].trim().toLowerCase() === wanted) {
      start = i + 1
      level = match[1].length
      break
    }
  }
  if (start < 0) return undefined

  let end = lines.length
  for (let i = start; i < lines.length; i++) {
    const match = /^(#{1,6})\s+/.exec(lines[i].trim())
    if (match && match[1].length <= level) {
      end = i
      break
    }
  }
  return lines.slice(start, end)
}

interface MarkdownTable {
  headers: string[]
  rows: string[][]
}

function firstTable(lines: string[]): MarkdownTable | undefined {
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue
    if (!lines[i + 1].trim().startsWith("|")) continue
    if (!isSeparatorRow(lines[i + 1])) continue

    const headers = splitMarkdownRow(lines[i]).map(x => x.trim().toLowerCase())
    const rows: string[][] = []

    for (let j = i + 2; j < lines.length; j++) {
      const line = lines[j].trim()
      if (!line.startsWith("|")) break
      rows.push(splitMarkdownRow(line))
    }
    return { headers, rows }
  }
  return undefined
}

function asStatus(text: string): LedgerStatus | undefined {
  const normalized = text.trim().toLowerCase().replace(/[`*_]/g, "")
  return (LEDGER_STATUSES as readonly string[]).includes(normalized)
    ? normalized as LedgerStatus
    : undefined
}

function parseCount(text: string): number | undefined {
  const normalized = text.trim().replace(/[`*_]/g, "")
  if (!/^\d+$/.test(normalized)) return undefined
  return Number(normalized)
}

/**
 * Validate bookkeeping consistency for build-ledger-shaped Markdown.
 *
 * This is intentionally narrow. It activates only when both
 * "Classification summary" and "Evidence table" sections exist.
 * It checks arithmetic, not semantic truth.
 */
export function validateLedgerConsistency(markdown: string): LedgerConsistencyResult {
  const declared = zeroCounts()
  const observed = zeroCounts()
  const mismatches: string[] = []

  const summarySection = section(markdown, "Classification summary")
  const evidenceSection = section(markdown, "Evidence table")

  if (!summarySection || !evidenceSection) {
    return {
      applicable: false,
      ok: true,
      declared,
      observed,
      observedTotal: 0,
      mismatches
    }
  }

  const summaryTable = firstTable(summarySection)
  const evidenceTable = firstTable(evidenceSection)

  if (!summaryTable) mismatches.push("classification summary table is missing or malformed")
  if (!evidenceTable) mismatches.push("evidence table is missing or malformed")

  if (summaryTable) {
    const statusIndex = summaryTable.headers.indexOf("status")
    const countIndex = summaryTable.headers.indexOf("count")
    if (statusIndex < 0 || countIndex < 0) {
      mismatches.push("classification summary must contain status and count columns")
    } else {
      for (const row of summaryTable.rows) {
        const status = asStatus(row[statusIndex] ?? "")
        if (!status) continue
        const count = parseCount(row[countIndex] ?? "")
        if (count === undefined) {
          mismatches.push(`classification summary count for ${status} is not an integer`)
          continue
        }
        declared[status] = count
      }
    }
  }

  if (evidenceTable) {
    const statusIndex = evidenceTable.headers.indexOf("status")
    if (statusIndex < 0) {
      mismatches.push("evidence table must contain a status column")
    } else {
      for (const row of evidenceTable.rows) {
        const status = asStatus(row[statusIndex] ?? "")
        if (status) observed[status]++
      }
    }
  }

  const declaredTotalMatch = summarySection.join("\n").match(/\bCounts:\s*(\d+)\s+items\b/i)
  const declaredTotal = declaredTotalMatch ? Number(declaredTotalMatch[1]) : undefined
  const observedTotal = LEDGER_STATUSES.reduce((sum, status) => sum + observed[status], 0)

  if (summaryTable && evidenceTable) {
    for (const status of LEDGER_STATUSES) {
      if (declared[status] !== observed[status]) {
        mismatches.push(`${status}: declared ${declared[status]}, observed ${observed[status]}`)
      }
    }
    if (declaredTotal !== undefined && declaredTotal !== observedTotal) {
      mismatches.push(`total: declared ${declaredTotal}, observed ${observedTotal}`)
    }
  }

  return {
    applicable: true,
    ok: mismatches.length === 0,
    declared,
    observed,
    declaredTotal,
    observedTotal,
    mismatches
  }
}

export function assertLedgerConsistency(markdown: string): LedgerConsistencyResult {
  const result = validateLedgerConsistency(markdown)
  if (result.applicable && !result.ok) {
    throw new Error(
      `DMT ledger consistency gate: ${result.mismatches.join("; ")}. ` +
      "Repair the classification summary only; do not rewrite evidence rows to make the counts fit."
    )
  }
  return result
}
