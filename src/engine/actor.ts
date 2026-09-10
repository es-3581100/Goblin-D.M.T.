/** Sequential mailbox actor. Mutable state is owned behind ask/tell; callers never receive a writable reference. */
export class SerialActor<T> {
  #state: T
  #tail: Promise<unknown> = Promise.resolve()
  constructor(initial: T) { this.#state = initial }

  ask<R>(fn: (state: T) => R | Promise<R>): Promise<R> {
    const run = this.#tail.then(() => fn(this.#state))
    this.#tail = run.then(() => undefined, () => undefined)
    return run
  }

  snapshot(clone: (state: T) => T): Promise<T> {
    return this.ask(s => clone(s))
  }
}
