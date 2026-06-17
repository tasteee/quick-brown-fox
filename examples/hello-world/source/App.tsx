import { useEffect, useState } from 'react'
import { api } from 'quick-brown-fox/client'

// The UI is a normal React app. It talks to the Node backend in ../server
// through `api`, which quick-brown-fox points at the local server for you.
export function App() {
  const [count, setCount] = useState(0)
  const [files, setFiles] = useState<string[]>([])
  const [time, setTime] = useState<string>('…')

  useEffect(() => {
    api.get<{ now: string }>('/time').then((d) => setTime(d.now))
  }, [])

  async function listFiles() {
    const data = await api.get<{ files: string[] }>('/files')
    setFiles(data.files)
  }

  return (
    <main className="app">
      <h1>🦊 Quick Brown Fox</h1>
      <p>A normal React app + a Node server, running as a desktop app.</p>

      <button onClick={() => setCount((c) => c + 1)}>Clicked {count} times</button>

      <section className="card">
        <p>
          Server time: <code>{time}</code>
        </p>
        <button onClick={listFiles}>List files in this project (via server)</button>
        {files.length > 0 && (
          <ul>
            {files.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="hint">
        Edit <code>source/App.tsx</code> or <code>server/main.ts</code> and save — it reloads.
      </p>
    </main>
  )
}
