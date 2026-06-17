// Type definitions for quick-brown-fox/client.

/** The base URL of the local server, e.g. "http://127.0.0.1:5197". */
export declare const serverUrl: string

/** True when running inside the quick-brown-fox desktop shell. */
export declare const isDesktop: boolean

export interface Api {
  /** fetch() against the local server. Returns the raw Response. */
  (path: string, init?: RequestInit): Promise<Response>
  /** GET a path and parse the JSON response. */
  get<T = unknown>(path: string, init?: RequestInit): Promise<T>
  /** POST a JSON body to a path and parse the JSON response. */
  post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>
}

export declare const api: Api
export default api

declare global {
  interface Window {
    qbf: {
      isDesktop: boolean
      platform: NodeJS.Platform | string
      serverUrl: string
    }
  }
}
