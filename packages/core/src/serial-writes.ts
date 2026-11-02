/** Ordered writes with latest-value coalescing. A failed write stays pending;
 * retries are explicit, and flush never reports success with unsaved values. */
export class SerialWrites<K, V> {
  private generation = 0;
  private pending = new Map<K, V>();
  private running: Promise<void> | null = null;
  private failure: unknown = null;
  private timer: (() => void) | null = null;
  constructor(
    private write: (key: K, value: V) => Promise<void>,
    private changed: () => void = () => {},
    private schedule?: (task: () => void, delay: number) => () => void,
  ) {}
  observe(changed: () => void) {
    this.changed = changed;
    return () => {
      this.changed = () => {};
    };
  }
  get busy() {
    return this.running !== null || this.pending.size > 0;
  }
  get error() {
    return this.failure;
  }
  enqueue(key: K, value: V, delayMs = 0) {
    this.pending.set(key, value);
    this.changed();
    this.timer?.();
    this.timer = null;
    if (delayMs > 0 && this.schedule && !this.running && !this.failure) {
      this.timer = this.schedule(() => {
        this.timer = null;
        this.start();
      }, delayMs);
    } else if (!this.failure) this.start();
  }
  private start() {
    if (this.running || !this.pending.size || this.failure) return;
    // Defer the loop so `running` exists even when the writer fails synchronously.
    this.running = Promise.resolve().then(async () => {
      while (this.pending.size && !this.failure) {
        const [key, value] = this.pending.entries().next().value!;
        this.pending.delete(key);
        const generation = this.generation;
        try {
          await this.write(key, value);
        } catch (error) {
          if (generation !== this.generation) continue;
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
    this.timer?.();
    this.timer = null;
    this.start();
    while (this.running) await this.running;
    if (this.failure) throw this.failure;
  }
  cancelPending() {
    this.generation++;
    this.timer?.();
    this.timer = null;
    this.pending.clear();
    this.failure = null;
    this.changed();
  }
  async retry() {
    this.failure = null;
    return this.flush();
  }
}
