/**
 * =============================================================================
 * AI TURBO PRO - ASYNC JOB WORKER (NODE.JS CONCURRENCY ENGINE)
 * Quản lý hàng đợi tác vụ đa luồng, xử lý I/O và điều tiết tải (Rate Limiting)
 * =============================================================================
 */

const EventEmitter = require('events');

class JobWorkerQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 4;
    this.queue = [];
    this.activeWorkers = 0;
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Thêm một tác vụ mới vào hàng đợi
   */
  enqueue(taskId, payload, handler) {
    const task = {
      id: taskId,
      payload,
      handler,
      status: 'queued',
      attempt: 0,
      maxRetries: 2,
      result: null,
      error: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };

    this.tasks.set(taskId, task);
    this.queue.push(task);
    this.emit('task:queued', task);

    this._dispatch();
    return task;
  }

  _dispatch() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.activeWorkers++;
    task.status = 'running';
    task.startedAt = Date.now();
    task.attempt++;
    this.emit('task:start', task);

    Promise.resolve()
      .then(() => task.handler(task.payload))
      .then((result) => {
        task.status = 'completed';
        task.result = result;
        task.completedAt = Date.now();
        this.emit('task:completed', task);
      })
      .catch((err) => {
        task.error = err.message || String(err);
        if (task.attempt <= task.maxRetries) {
          task.status = 'retrying';
          this.emit('task:retry', task);
          this.queue.push(task);
        } else {
          task.status = 'failed';
          task.completedAt = Date.now();
          this.emit('task:failed', task);
        }
      })
      .finally(() => {
        this.activeWorkers--;
        this._dispatch();
        if (this.activeWorkers === 0 && this.queue.length === 0) {
          this.emit('drain');
        }
      });
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  getStats() {
    const total = this.tasks.size;
    let completed = 0;
    let failed = 0;
    let running = 0;
    let queued = 0;

    for (const t of this.tasks.values()) {
      if (t.status === 'completed') completed++;
      else if (t.status === 'failed') failed++;
      else if (t.status === 'running') running++;
      else if (t.status === 'queued' || t.status === 'retrying') queued++;
    }

    return { total, activeWorkers: this.activeWorkers, queued, running, completed, failed };
  }
}

// =============================================================================
// KỊCH BẢN CHẠY TEST ĐỘC LẬP (CLI RUNNER)
// =============================================================================
if (require.main === module) {
  console.log('=== KHỞI CHẠY ASYNC JOB WORKER (NODE.JS) ===');
  const workerQueue = new JobWorkerQueue({ concurrency: 3 });

  // Giả lập tác vụ xử lý
  const simulateAsyncJob = (data) =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({ processedId: data.id, timestamp: new Date().toISOString() });
      }, 50);
    });

  console.log('[*] Đang nạp 10 tác vụ vào hàng đợi với Concurrency = 3...');
  for (let i = 1; i <= 10; i++) {
    workerQueue.enqueue(`job_${i}`, { id: i, label: `Item #${i}` }, simulateAsyncJob);
  }

  workerQueue.on('drain', () => {
    console.log('[✔] Toàn bộ hàng đợi đã được xử lý hoàn tất!');
    console.log('[*] Thống kê:', workerQueue.getStats());
  });
}

module.exports = JobWorkerQueue;
