/* eslint-disable jest/no-conditional-expect */
import {
  WeightedPromisePool,
  WeightedTask,
  Decision,
  DecisionReturner,
} from '../src';

describe('WeightedPromisePool', () => {
  let tasksReturner: DecisionReturner<number>;
  const maxWeight = 20;
  const primes = [2, 3, 5, 7, 11, 13];
  const squares = primes.map((n) => n * n);
  let idx: number;

  beforeEach(() => {
    idx = 0;

    tasksReturner = jest.fn((currentWeight: number): Decision<number> => {
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
          // eslint-disable-next-line jest/valid-expect-in-promise
          promise: new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(prime * prime);
            }, prime * 10);
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
    });
  });

  describe('constructor', () => {
    it('Rejects invalid max weight', () => {
      expect(
        () =>
          new WeightedPromisePool<number>(
            0, // invalid max weight
            tasksReturner
          )
      ).toThrow('Max weight must be positive');
    });
  });

  describe('run', () => {
    it('Executes as expected', async () => {
      const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);
      const { results: returnedSquares } = await pool.run();

      // First invocation should pass available weight = 0
      // Should return tasks for the primes [2, 3, 5, 7]
      // Should takes total weight from 0 to 17

      // Once task for prime 2 finishes, next invocation should pass current weight = 15
      // Should return 'wait' because prime 11 cannot be added yet

      // Once task for prime 3 finishes, next invocation should pass current weight = 12
      // Should return 'wait' because prime 11 cannot be added yet

      // Once task for prime 5 finishes, next invocation should pass current weight = 7
      // Should return tasks for primes [11]
      // Should take total weight from 7 to 18

      // Once task for prime 7 finishes, next invocation should pass current weight = 11
      // Should return 'wait' because prime 13 cannot be added yet

      // Once task for prime 11 finishes, next invocation should pass current weight = 0
      // Should return tasks for primes [13]
      // Should take total weight from 0 to 13

      // Once task for prime 13 finishes, next invocation should pass current weight = 0
      // Should return null because there are no primes left to process

      expect(tasksReturner).toBeCalledTimes(7);
      expect(returnedSquares).toEqual(squares);
    });

    it('Can run twice', async () => {
      const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);
      const { results: returnedSquares1 } = await pool.run();

      idx = 0;
      const { results: returnedSquares2 } = await pool.run();

      expect(returnedSquares1).toEqual(returnedSquares2);
    });

    it('Fails if already running', async () => {
      const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);

      // Start it
      pool.run();

      // While it's still running, try running it again
      expect(() => {
        pool.run();
      }).toThrow(/Unexpected state/);
    });
  });
});
