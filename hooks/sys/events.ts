// A minimal EventEmitter for the child-process and request stand-ins.

type Listener = (...args: any[]) => void

export class EventEmitter {
  private listeners = new Map<string, Listener[]>()

  on(event: string, fn: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn])
    return this
  }

  addListener(event: string, fn: Listener): this {
    return this.on(event, fn)
  }

  once(event: string, fn: Listener): this {
    const wrap: Listener = (...args) => {
      this.off(event, wrap)
      fn(...args)
    }
    return this.on(event, wrap)
  }

  off(event: string, fn: Listener): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== fn))
    return this
  }

  removeListener(event: string, fn: Listener): this {
    return this.off(event, fn)
  }

  removeAllListeners(event?: string): this {
    if (event) this.listeners.delete(event)
    else this.listeners.clear()
    return this
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this.listeners.get(event) ?? []
    for (const fn of list) fn(...args)
    return list.length > 0
  }
}

export default EventEmitter
