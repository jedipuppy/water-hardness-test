import { NavLink, Route, Routes } from 'react-router-dom'
import InputPage from './pages/InputPage'
import ResultsPage from './pages/ResultsPage'
import './App.css'

const navLinks = [
  { to: '/', label: '入力' },
  { to: '/results', label: '集計' },
]

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">効き水データ収集</h1>
          <p className="app-subtitle">
            ドラッグ＆ドロップで回答を提出し、統計的に可視化します。
          </p>
        </div>
        <nav>
          <ul className="app-nav">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `app-nav-link ${isActive ? 'is-active' : ''}`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<InputPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>
          © {new Date().getFullYear()} データサイエンス入門（担当：田中香津生）
        </span>
      </footer>
    </div>
  )
}

export default App
