export function mapValues<T, U>(obj: Record<string, T>, callback: (value: T, key: string) => U): U[]{
  return Object.keys(obj).map(key => callback(obj[key], key))
}

export function forEachValues<T, U>(obj: Record<string, T>, callback: (value: T, key: string) => void): void{
  Object.keys(obj).forEach(key => callback(obj[key], key))
}