import createDebug from 'debug';

const debug = createDebug('weighted-promise-pool');

export interface WeightedTask<T> {
  weight: number;
  promise: Promise<T>;
}

export type Decision<T> =
  | WeightedTask<T>[] // "async tasks started running, here they are"
  | 'wait' // "not ready to start another task yet"
  | null; // "no more work left to do"

export type DecisionReturner<T> = (currentWeight: number) => Decision<T>;

interface WeightedPromisePoolResults<T> {
  results: T[];
}

export class WeightedPromisePool<T> {
  /**
   * Max allowed "weight" of all the async tasks in progress
   *
   * Consumers are expected to not run tasks that would exceed this limit; but if they do, we will
   * not ask for more tasks until the current weight falls below the max
   */
  #maxWeight: number;

  /**
   * Caller-supplied callback that starts async tasks (when appropriate) and hands us their weights
   * and promises
   */
  #next: DecisionReturner<T>;

  // INTERNAL STATE

  #running = false;

  /**
   * Total weight of the async tasks in progress
   * Not necessarily the number of tasks in progress
   * Consumer can specify the weights when
   */
  #currentWeight = 0;

  /**
   * Results of async tasks
   */
  #results: T[] = [];

  // Assume consumer has more work to do until its 'next' function returns null
  #hasMore = true;

  /**
   * Hang onto our resolve and reject functions so we can resolve our promise when all async tasks
   * are complete
   */
  #deferred:
    | {
        resolve: (value: WeightedPromisePoolResults<T>) => void;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reject: (reason?: any) => void;
      }
    | undefined;

  constructor(maxWeight: number, next: DecisionReturner<T>) {
    if (maxWeight <= 0) {
      throw new Error('Max weight must be positive');
    }

    this.#maxWeight = maxWeight;
    this.#next = next;
  }

  /**
   * Runs all promises returned by the user-provided `next` function
   */
  run(): Promise<WeightedPromisePoolResults<T>> {
    if (this.#running) {
      throw new Error(
        'Unexpected state: Cannot run while pool is already running'
      );
    }

    this.#currentWeight = 0;
    this.#results = [];
    this.#hasMore = true;
    this.#running = true;

    return new Promise((resolve, reject) => {
      this.#deferred = {
        resolve,
        reject,
      };

      this.runNext();
    });
  }

  private runNext(): void {
    debug(
      `runNext: currentWeight=${this.#currentWeight}, hasMore=${this.#hasMore}`
    );
    if (this.#currentWeight === 0 && !this.#hasMore) {
      this.finish();
      return;
    }

    if (this.#currentWeight < this.#maxWeight && this.#hasMore) {
      // Ask consumer for more tasks
      debug(`Asking for tasks, currentWeight=${this.#currentWeight}`);
      const decision = this.#next(this.#currentWeight);

      if (decision === null) {
        // Consumer has indicated it has no more tasks to give us, ever
        this.#hasMore = false;
        debug('Consumer said there are no more tasks');
        if (this.#currentWeight === 0) {
          this.finish();
        }
      } else if (decision === 'wait') {
        // Consumer has more tasks to give us in the future, but not now
        debug('Consumer said to wait');
      } else {
        // Work was started
        const nextTasks = decision;
        // eslint-disable-next-line no-restricted-syntax
        debug(`nextTasks=${nextTasks}`);
        for (let i = 0; i < nextTasks.length; i += 1) {
          const { weight, promise } = nextTasks[i];
          debug(`Got new task with weight=${weight}`);
          this.#currentWeight += weight;

          // eslint-disable-next-line promise/catch-or-return
          promise
            // eslint-disable-next-line promise/always-return
            .then((result: T) => {
              this.#results.push(result);
            })
            .finally(() => {
              debug(`Finished task with weight ${weight}`);
              this.#currentWeight -= weight;
              this.runNext();
            });
        }
      }
    } else {
      throw new Error(`Unexpected`);
    }
  }

  private finish(): void {
    if (this.#currentWeight !== 0 || this.#hasMore) {
      throw new Error(
        `Unexpected state when finish() called: currentWeight=${
          this.#currentWeight
        }, hasMore=${this.#hasMore}`
      );
    }

    // All promises have resolved, and the caller doesn't have any more work for us to do
    // We're done here!
    debug('finish: All work completed!');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.#deferred!.resolve({
      results: this.#results,
    });

    this.#running = false;
  }
}
