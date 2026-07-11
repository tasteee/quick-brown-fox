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

export interface FileDialogFilter {
  name: string
  extensions: string[]
}

export interface FileDialogOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  message?: string
  filters?: FileDialogFilter[]
}

export interface Filesystem {
  readonly enabled: boolean
  /** Ask the user to select one file. Returns null when canceled. */
  openFile(options?: FileDialogOptions): Promise<string | null>
  /** Ask the user to select one or more files. Returns [] when canceled. */
  openFiles(options?: FileDialogOptions): Promise<string[]>
  /** Ask the user to select one folder. Returns null when canceled. */
  openFolder(options?: FileDialogOptions): Promise<string | null>
  /** Ask the user to select one or more folders. Returns [] when canceled. */
  openFolders(options?: FileDialogOptions): Promise<string[]>
}

export declare const filesystem: Filesystem

declare global {
  interface Window {
    qbf: {
      isDesktop: boolean
      platform: NodeJS.Platform | string
      serverUrl: string
      filesystem?: Filesystem
    }
  }
}
