export default interface Type {
  getImportType(): null | string
  
  toString(): string
}