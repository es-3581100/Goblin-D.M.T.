import { createHash } from "node:crypto"
import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"

export function nowIso(): string { return new Date().toISOString() }

export function stableJson(value: unknown): string {
  const sort = (v: any): any => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]))
    }
    return v
  }
  return JSON.stringify(sort(value))
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

export async function atomicWrite(file: string, data: string | Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, data)
  await rename(tmp, file)
}

export function slug(input: string): string {
  const s = input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  if (!s || s === "." || s === "..") throw new Error("name must contain a safe alphanumeric character")
  return s.slice(0, 96)
}

export function globMatch(pattern: string, target: string): boolean {
  const escapeRegex = (s: string) => s.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
  const normalized = pattern.replace(/\\/g, "/")
  const parts = normalized.split("**").map(part => escapeRegex(part).replace(/\\\*/g, "[^/]*"))
  const regex = parts.join(".*")
  return new RegExp(`^${regex}$`).test(target.replace(/\\/g, "/"))
}
