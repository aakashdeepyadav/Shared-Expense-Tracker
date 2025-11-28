// A simple, browser-safe event emitter.
class SafeEventEmitter {
  private events: Record<string, ((...args: any[]) => void)[]> = {};

  on(event: string, listener: (...args: any[]) => void) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: (...args: any[]) => void) {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    
    // Create a copy of the listeners array in case one of them modifies the original array
    const listeners = this.events[event].slice();
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (e) {
        console.error(`Error in EventEmitter listener for event "${event}":`, e);
      }
    }
  }
}

// This is a simple event emitter that will be used to broadcast errors
// from the data layer to the UI layer without tightly coupling them.
export const errorEmitter = new SafeEventEmitter();
