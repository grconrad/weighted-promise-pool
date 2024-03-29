import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  WeightedPromisePool,
  WeightedTask,
  Decision,
  DecisionReturner,
} from '../src';

describe('WeightedPromisePool', () => {
  describe('constructor', () => {
    test('Rejects invalid max weight', () => {
      expect(
        () =>
          new WeightedPromisePool<number>(
            0, // invalid max weight
            () => null
          )
      ).toThrow('Max weight must be positive');
    });
  });

  describe('primes', () => {
    let idx: number;
    let tasksReturner: DecisionReturner<number>;
    const maxWeight = 20;
    const primes = [2, 3, 5, 7, 11, 13];
    const squares = primes.map((n) => n * n);

    beforeEach(() => {
      idx = 0;

      tasksReturner = vi.fn((currentWeight: number): Decision<number> => {
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

    describe('run', () => {
      test('Executes as expected', async () => {
        const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);
        const { results: returnedSquares } = await pool.run();

        // First invocation should pass available weight = 0
        // Should return tasks for the primes [2, 3, 5, 7]
        // Should take total weight from 0 to 17

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

      test('Can run twice', async () => {
        const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);
        const { results: returnedSquares1 } = await pool.run();

        idx = 0;
        const { results: returnedSquares2 } = await pool.run();

        expect(returnedSquares1).toEqual(returnedSquares2);
      });

      test('Fails if already running', async () => {
        const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);

        // Start it
        const runPromise = pool.run();

        // While it's still running, try running it again
        expect(() => {
          pool.run();
        }).toThrow(/Unexpected state/);

        await runPromise;
      });
    });
  });

  describe('fruits', () => {
    let tasksReturner: DecisionReturner<number>;
    const maxWeight = 16; // 11 + 5
    const fruits = [
      'pomegranate', // 11
      'apple', // 5
    ];
    let idx: number;

    beforeEach(() => {
      idx = 0;

      tasksReturner = vi.fn((currentWeight: number): Decision<number> => {
        // Find all the fruits we can process now

        if (idx >= fruits.length) {
          // No more fruits left to process
          return null;
        }

        let availableWeight = maxWeight - currentWeight;
        const newTasks: WeightedTask<number>[] = [];

        while (idx < fruits.length) {
          // Can next fruit be processed now?
          // Just for testing purposes, define the processing weight as the length of the name
          const weight = fruits[idx].length;

          if (weight > availableWeight) {
            // Can't process the next fruit yet with the available budget
            break;
          }

          // We'll take it!
          const fruit = fruits[idx];
          newTasks.push({
            weight,
            promise: new Promise<number>((resolve) => {
              setTimeout(() => {
                resolve(fruit.length);
              }, fruit.length * 100);
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

    describe('run', () => {
      test('Executes as expected', async () => {
        const pool = new WeightedPromisePool<number>(maxWeight, tasksReturner);
        const { results: returnedLengths } = await pool.run();

        // First invocation should pass available weight = 0
        // Should return tasks for the fruits ['pomegranate', 'apple']
        // Should take total weight from 0 to 16

        // Once task for 'apple' finishes, next invocation should pass current weight = 11
        // Should return null because there are no fruits left to process

        expect(tasksReturner).toBeCalledTimes(2);
        expect(returnedLengths).toEqual([5, 11]);
      });
    });
  });
});
