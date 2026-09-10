export interface GraphNode<TContext = unknown> {
  id: string
  deps?: string[]
  run: (deps: Record<string, unknown>, context: TContext) => unknown | Promise<unknown>
}

/** Dream-Textures-inspired output-driven executor: recursively resolves upstream dependencies, caches once per render, and supports cancellation. */
export class LazyGraph<TContext = unknown> {
  #nodes = new Map<string, GraphNode<TContext>>()
  constructor(nodes: GraphNode<TContext>[]) {
    for (const node of nodes) {
      if (this.#nodes.has(node.id)) throw new Error(`duplicate graph node: ${node.id}`)
      this.#nodes.set(node.id, node)
    }
  }

  async render(outputId: string, context: TContext, cancelled: () => boolean = () => false): Promise<unknown> {
    const cache = new Map<string, unknown>()
    const visiting = new Set<string>()
    const execute = async (id: string): Promise<unknown> => {
      if (cancelled()) throw new Error("graph execution cancelled")
      if (cache.has(id)) return cache.get(id)
      if (visiting.has(id)) throw new Error(`cycle detected at node ${id}`)
      const node = this.#nodes.get(id)
      if (!node) throw new Error(`unknown graph node: ${id}`)
      visiting.add(id)
      const deps: Record<string, unknown> = {}
      for (const dep of node.deps ?? []) deps[dep] = await execute(dep)
      const value = await node.run(deps, context)
      visiting.delete(id)
      cache.set(id, value)
      return value
    }
    return execute(outputId)
  }
}
