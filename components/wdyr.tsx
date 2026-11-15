"use client"

/// <reference types="@welldone-software/why-did-you-render" />
import React from "react"

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const whyDidYouRender = require("@welldone-software/why-did-you-render")
  whyDidYouRender(React, {
    trackAllPureComponents: false,
    trackHooks: false,
    logOnDifferentValues: true,
  })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jsxDevRuntime = require("react/jsx-dev-runtime")
    const origJsxDev = jsxDevRuntime.jsxDEV
    if (origJsxDev && !jsxDevRuntime.__IS_WDYR__) {
      jsxDevRuntime.__IS_WDYR__ = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jsxDevRuntime.jsxDEV = function (origType: any, ...rest: any[]) {
        const WDYRType =
          typeof whyDidYouRender.getWDYRType === "function"
            ? whyDidYouRender.getWDYRType(origType)
            : null

        return origJsxDev.apply(this, [WDYRType || origType, ...rest])
      }
    }
  } catch {
    // Ignore in unsupported environments
  }

  console.info(
    "[WDYR] Active and tracking re-renders for components with .whyDidYouRender = true"
  )
}

export function WhyDidYouRenderInit() {
  return null
}
