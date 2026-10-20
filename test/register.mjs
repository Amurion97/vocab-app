import { register } from "node:module"

register(new URL("./alias-hooks.mjs", import.meta.url).href, import.meta.url)
