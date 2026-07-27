type Listener = (loading: boolean, pending: number) => void

let pending = 0
const listeners = new Set<Listener>()

function notify() {
  const loading = pending > 0
  listeners.forEach((listener) => listener(loading, pending))
}

export const apiLoading = {
  start() {
    pending += 1
    notify()
  },

  stop() {
    pending = Math.max(0, pending - 1)
    notify()
  },

  reset() {
    pending = 0
    notify()
  },

  isLoading() {
    return pending > 0
  },

  getPending() {
    return pending
  },

  subscribe(listener: Listener) {
    listeners.add(listener)
    listener(pending > 0, pending)
    return () => {
      listeners.delete(listener)
    }
  },
}
