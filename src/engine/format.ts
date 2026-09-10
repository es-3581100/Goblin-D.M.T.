export type FormatProfile = "markdown" | "plain" | "json"

export function formatMarkdown(input: string): string {
  const lines = input.replace(/\r\n?/g, "\n").split("\n").map(l => l.replace(/[ \t]+$/g, ""))
  const out: string[] = []
  let blanks = 0
  for (const line of lines) {
    if (!line) {
      blanks++
      if (blanks <= 2) out.push("")
    } else {
      blanks = 0
      out.push(line)
    }
  }
  return out.join("\n").trim() + "\n"
}

export function formatOutput(input: string, profile: FormatProfile): string {
  if (profile === "plain") return input.replace(/\r\n?/g, "\n").trim() + "\n"
  if (profile === "json") {
    const value = JSON.parse(input)
    return JSON.stringify(value, null, 2) + "\n"
  }
  return formatMarkdown(input)
}
