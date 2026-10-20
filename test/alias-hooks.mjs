import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

function resolveExisting(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = resolveExisting(path.join(root, specifier.slice(2)))
    if (found) {
      return nextResolve(pathToFileURL(found).href, context)
    }
  }

  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
    const found = resolveExisting(fileURLToPath(new URL(specifier, context.parentURL)))
    if (found) {
      return nextResolve(pathToFileURL(found).href, context)
    }
  }

  return nextResolve(specifier, context)
}
