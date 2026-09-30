import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shell.css'
import './styles/cultivate.css'
import './styles/battle.css'
import './styles/gongfa.css'
import './styles/jianghu.css'
import App from './App.tsx'
import { initTheme } from './theme/themePreference'

// 启动即套用已保存的皮肤：否则刷新后 data-theme 缺失，界面会退回默认夜雨账台
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
