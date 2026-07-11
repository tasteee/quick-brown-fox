export interface RenderOptions<Props = Record<string, unknown>> {
  /** CSS selector or element to mount into. Defaults to #root. */
  target?: string | Element | null
  /** Props passed to the root component. */
  props?: Props
}

export declare function render<Props = Record<string, unknown>, Mounted = unknown>(
  component: unknown,
  options?: RenderOptions<Props>
): Mounted

export default render
