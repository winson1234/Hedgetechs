class RequestQueue {
    private queue: Array<() => Promise<unknown>> = [];
    private processing = false;
    private maxConcurrent = 3; // Maximum concurrent requests
    private activeRequests = 0;
  
    async add<T>(requestFn: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const result = await requestFn();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
        this.process();
      });
    }
  
    private async process() {
      if (this.processing) return;
      this.processing = true;
  
      while (this.queue.length > 0) {
        if (this.activeRequests >= this.maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
  
        const request = this.queue.shift();
        if (request) {
          this.activeRequests++;
          request().finally(() => {
            this.activeRequests--;
          });
        }
      }
  
      this.processing = false;
    }
  }
  
  export const klineQueue = new RequestQueue();