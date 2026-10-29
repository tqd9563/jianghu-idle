import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shell.css'
import './styles/cultivate.css'
import './styles/qianchen.css'
import './styles/battle.css'
import './styles/gongfa.css'
import './styles/jianghu.css'
import './styles/sect.css'
import './styles/bag.css'
import './styles/market.css'
import './styles/chronicle.css'
import App from './App.tsx'
import { initTheme } from './theme/themePreference'
import { installReportLog } from './dev/reportLog'

// 启动即套用已保存的皮肤：否则刷新后 data-theme 缺失，界面会退回默认夜雨账台
initTheme()
// 开发期记录控制台错误，供提报面板一并带走
if (import.meta.env.DEV) installReportLog()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
