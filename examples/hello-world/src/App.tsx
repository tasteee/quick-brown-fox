import { useState } from 'react'

export function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="app">
      <h1>🦊 Quick Brown Fox</h1>
      <p>A normal React app, running as a desktop app.</p>
      <button onClick={() => setCount((c) => c + 1)}>Clicked {count} times</button>
      <p className="hint">Edit <code>src/App.tsx</code> and save — it hot-reloads.</p>
    </main>
  )
}
