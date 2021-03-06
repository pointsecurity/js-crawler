/*
 * Executor that handles throttling and task processing rate.
 */

export type ExecutableTask = () => Promise<void>

export interface ExecutorOptions {
  maxRatePerSecond: number,
  maxConcurrentTasks: number
}

export default class Executor {
  maxRatePerSecond: number;
  maxConcurrentTasks: number;
  concurrentTaskNumber: number;
  queue: Array<ExecutableTask>;
  isStopped: boolean;
  timeoutMs: number;

  constructor({maxRatePerSecond, maxConcurrentTasks}: ExecutorOptions) {
    this.maxRatePerSecond = maxRatePerSecond;
    this.maxConcurrentTasks = maxConcurrentTasks || Number.MAX_VALUE;
    this.concurrentTaskNumber = 0;
    this.queue = [];
    this.isStopped = false;
    this.timeoutMs = (1 / this.maxRatePerSecond) * 1000;
  }

  submit(task: ExecutableTask) {
    this.queue.push(task);
  }

  start() {
    this.processQueueItem();
  }

  stop() {
    this.isStopped = true;
  }

  hasTooManyConcurrentTasks() {
    return this.concurrentTaskNumber >= this.maxConcurrentTasks;
  }

  processQueueItem() {
    if (!this.hasTooManyConcurrentTasks()) {
      if (this.queue.length !== 0) {
        const nextExecution = this.queue.shift();
        this.concurrentTaskNumber++;
        nextExecution().then(() => {
          this.concurrentTaskNumber--;
        });
      }
    }
    if (this.isStopped) {
      return;
    }
    setTimeout(() => {
      this.processQueueItem();
    }, this.timeoutMs);
  }
}