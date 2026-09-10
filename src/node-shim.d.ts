declare const process: any
declare const Buffer: any
type Buffer = any

declare module "node:crypto" {
  export const createHash: any
  export const randomUUID: any
}
declare module "node:fs/promises" {
  export const mkdir: any
  export const rename: any
  export const writeFile: any
  export const readFile: any
  export const readdir: any
  export const stat: any
  export const cp: any
  export const mkdtemp: any
  export const rm: any
  export const copyFile: any
}
declare module "node:path" { const path: any; export default path }
declare module "node:os" { const os: any; export default os }
declare module "node:url" { export const fileURLToPath: any }
declare module "node:child_process" { export const spawn: any }
