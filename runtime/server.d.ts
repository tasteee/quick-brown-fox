// Type definitions for quick-brown-fox/server.

import type { IncomingMessage, ServerResponse } from 'http'

/** The incoming request, with the body already parsed for you. */
export interface QbfRequest {
  /** HTTP method, e.g. "GET", "POST". */
  method: string
  /** URL pathname, e.g. "/files". */
  path: string
  /** The raw request URL, e.g. "/files?id=3". */
  url: string
  /** Parsed query-string parameters. */
  query: Record<string, string>
  /** Alias of `query` — "any parameters" on the request. */
  params: Record<string, string>
  /** Request headers. */
  headers: Record<string, string | string[] | undefined>
  /**
   * The parsed request body: an object for JSON / form payloads, a string for
   * text, a Buffer for binary, or undefined when there is no body.
   */
  body: unknown
}

/** Chainable helpers for sending a response. */
export interface QbfResponse {
  /** The underlying Node response, for advanced use. */
  raw: ServerResponse
  /** Set the HTTP status code. */
  status(code: number): QbfResponse
  /** Set a response header. */
  header(name: string, value: string): QbfResponse
  /** Send a raw body with an optional content type. */
  send(body: string | Buffer, contentType?: string): QbfResponse
  /** Send a JSON response. */
  json(data: unknown, code?: number): QbfResponse
  /** Send a plain-text response. */
  text(data: string, code?: number): QbfResponse
  /** Send an HTML response. */
  html(markup: string, code?: number): QbfResponse
  /** Redirect to another location (default 302). */
  redirect(location: string, code?: number): QbfResponse
  /** Send a 404 JSON response. */
  notFound(message?: string): QbfResponse
  /** Whether a response has already been sent. */
  readonly sent: boolean
}

/** The context passed to your server handler. */
export interface Context {
  request: QbfRequest
  response: QbfResponse
  /** The underlying Node request object. */
  req: IncomingMessage
  /** The underlying Node response object. */
  res: ServerResponse
}

/**
 * A server handler. Return a value to send it as JSON, or use `ctx.response`
 * to send a response yourself. May be async.
 */
export type Handler = (ctx: Context) => unknown | Promise<unknown>
export type NodeHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => unknown | Promise<unknown>

export declare function defineServer<T extends Handler | NodeHandler>(handler: T): T
export default defineServer
