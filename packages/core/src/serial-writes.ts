/** Ordered writes with latest-value coalescing. A failed write stays pending;
 * retries are explicit, and flush never reports success with unsaved values. */
export class SerialWrites<K, V> {
  private pending = new Map<K, V>();
  private running: Promise<void> | null = null;
  private failure: unknown = null;
  constructor(
    private write: (key: K, value: V) => Promise<void>,
    private changed: () => void = () => {},
  ) {}
  get busy() {
    return this.running !== null || this.pending.size > 0;
  }
  get error() {
    return this.failure;
  }
  enqueue(key: K, value: V) {
    this.pending.set(key, value);
    this.changed();
    if (!this.failure) this.start();
  }
  private start() {
    if (this.running || !this.pending.size || this.failure) return;
    // Defer the loop so `running` exists even when the writer fails synchronously.
    this.running = Promise.resolve().then(async () => {
      while (this.pending.size && !this.failure) {
        const [key, value] = this.pending.entries().next().value!;
        this.pending.delete(key);
        try {
          await this.write(key, value);
        } catch (error) {
          // A newer edit must win over the failed, older request.
          if (!this.pending.has(key)) this.pending.set(key, value);
          this.failure = error;
        }
      }
    }).finally(() => {
      this.running = null;
      this.changed();
    });
    this.changed();
  }
  async flush() {
    this.start();
    while (this.running) await this.running;
    if (this.failure) throw this.failure;
  }
  async retry() {
    this.failure = null;
    return this.flush();
  }
}
