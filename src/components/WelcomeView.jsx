import { useRef } from 'react'

export default function WelcomeView({ onLoad, onCreate, onLoadExample }) {
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    onLoad(file)
  }

  return (
    <div className="welcome">
      <div className="welcome-mark">字</div>
      <h1 className="welcome-title">Radix</h1>
      <p className="welcome-lead">
        Learn Hanzi and Kanji by building each character out of named parts
        and a story that holds them together.
      </p>

      <div className="welcome-actions">
        <label className="btn btn-primary btn-lg">
          Open a library file
          <input ref={fileRef} type="file" accept=".json" className="sr-only" onChange={handleFile} />
        </label>
        <button className="btn btn-lg" onClick={onLoadExample}>Try the example</button>
        <button className="btn btn-lg" onClick={onCreate}>Start empty</button>
      </div>

      <dl className="welcome-types">
        <div><dt className="t-character">Character</dt><dd>has a keyword you are tested on</dd></div>
        <div><dt className="t-primitive">Primitive</dt><dd>a building block that only appears inside stories</dd></div>
        <div><dt className="t-dual">Dual</dt><dd>a character that is also a building block</dd></div>
      </dl>
    </div>
  )
}
