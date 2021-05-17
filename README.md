# weighted-promise-pool

A traditional promise pool manages task concurrency as the number of unresolved promises (async tasks) created by the caller. When the caller kicks off the the next async task, the concurrency count gets bumped by 1. When a promise finishes, the pool decrements the count by 1. All async tasks are treated as equals and assigned an effective weight of 1 by the pool.

`weighted-promise-pool` expands the notion of concurrency, definining it as a total weight of async tasks in flight. The consumer provides the weight of each task to the pool just after triggering the task. The consumer can also take into account the total weight when deciding whether to trigger more async tasks, whenever an async task completes (when the pool invokes the callback).

In practice, this notion of weight might be a proxy for resource consumption, i.e. the number of CPU cores or a heuristic that approximates computational complexity of the async task.

Example: Consumer knows the host environment can support a total weight of 30. Currently, the pool is tracking that the outstanding tasks have a total weight of 27. This leaves only an available weight of 30 - 27 = 3 (capacity). In this state, the consumer can decide _not_ to hand over the next async task whose weight is 5 (since doing so would exceed the available capacity), or it can select a different async task with a weight <= 3 and begin that task and hand it over the pool.

## Examples

```ts
import {
  WeightedPromisePool,
  WeightedTask,
  Decision,
} from '@grconrad/weighted-promise-pool';

const maxWeight = 20;

const primes = [2, 3, 5, 7, 11, 13];

let idx = 0;

const tasksReturner = (currentWeight: number): Decision<number> => {
  // Find all the primes we can process now

  if (idx >= primes.length) {
    // No more primes left to process
    return null;
  }

  let availableWeight = maxWeight - currentWeight;
  const newTasks: WeightedTask<number>[] = [];

  while (idx < primes.length) {
    // Can next prime be processed now?
    // Just for testing purposes, define the processing weight as the prime's value
    const weight = primes[idx];

    if (weight > availableWeight) {
      // Can't process the next prime yet with the available budget
      break;
    }

    // We'll take it!
    const prime = primes[idx];
    newTasks.push({
      weight,
      promise: new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(prime * prime);
        }, 100);
      }),
    });

    idx += 1;
    availableWeight -= weight;
  }

  if (newTasks.length > 0) {
    // We started new tasks, so hand them to the pool
    return newTasks;
  }

  // There are more async tasks but we can't start them yet
  return 'wait';
};

const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);

const { results: squares } = await pool.run();
```
