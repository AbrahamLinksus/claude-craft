/** Streaming-input iterable for `query()`: `push` queues a message, `end` finishes the stream. */
export class InputQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void) | undefined;
  private ended = false;

  push(item: T): void {
    if (this.ended) return;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = undefined;
      resolve({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  end(): void {
    this.ended = true;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = undefined;
      resolve({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item !== undefined) return Promise.resolve({ value: item, done: false });
        if (this.ended) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => {
          this.waiting = resolve;
        });
      },
    };
  }
}
