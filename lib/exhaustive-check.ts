/**
 * perform static type check if some cases are not handled, e.g.
 * type fruit = "orange" | "apple" | "banana"
 * if only "orange" and "apple" are handled, then it will throw typescript
 * static type check error error
 * if somehow error is not checked, it will throw runtime error
 * @param x case that should not exists
 * @param errorMsg custom error message to throw
 */
export const exhaustiveCheck = (x: never, errorMsg?: string) => {
  if (errorMsg) {
    throw new Error(errorMsg);
  }
  throw new Error("Unhandled case: " + x);
};

/**
 * @augments exhaustiveCheck
 */
export const assertUnreachable = exhaustiveCheck;
