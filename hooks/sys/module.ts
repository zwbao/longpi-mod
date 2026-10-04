// node:module: nothing is required at run time in the mod.
export function createRequire(_from: string): (id: string) => never {
  return (id: string) => {
    throw new Error(`require(${id}) is not available in the LongPi mod`)
  }
}
