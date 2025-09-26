import { useState } from 'react'
import { 
  Menu, X, LayoutGrid, Router, Printer, Box, Moon, Sun, CheckSquare, Settings, Home, Network
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/contexts/theme'
import { HeaderDropdowns } from './PopUp'
import { useNavigationStore } from '@/store/navigation'
import React from 'react'
import {NavigationItem, NavLinkProps} from '@/types'

interface ExtendedNavLinkProps extends NavLinkProps {
  index?: number;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Início', href: 'dashboard', icon: Home },
  { name: 'Dispositivos', href: 'devices', icon: LayoutGrid },
  { name: 'Roteadores', href: 'routers', icon: Router },
  { name: 'Impressoras', href: 'printers', icon: Printer },
  { name: 'Tarefas', href: 'tasks', icon: CheckSquare },
  { name: 'Caixas', href: 'boxes', icon: Box },
  { name: 'Switches', href: 'switches', icon: Network },
  { name: 'Salas', href: 'room', icon: Box },
  { name: 'Configurações', href: 'settings', icon: Settings },
  
]

const Logo = () => (
  <div className="flex items-center animate-fade-in">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-md transform transition-all duration-500 hover:scale-110 hover:rotate-12 hover:shadow-xl">
      <LayoutGrid className="h-5 w-5 text-white transition-transform duration-300" />
    </div>
    <h1 className="ml-3 text-xl lg:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 truncate animate-slide-in-right">
      Super IPS
    </h1>
  </div>
)

const NavLink: React.FC<ExtendedNavLinkProps> = ({ item, mobile = false, onClick, index = 0 }) => {
  const currentPage = useNavigationStore((state) => state.currentPage)
  const setPage = useNavigationStore((state) => state.setPage)
  const Icon = item.icon
  const isActive = currentPage === item.href

  const handleClick = () => {
    setPage(item.href)
    onClick?.()
  }

  return (
    <button
      onClick={handleClick}
      style={{ 
        animationDelay: mobile ? `${index * 100}ms` : '0ms' 
      }}
      className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-500 transform mx-2 hover:scale-105
        ${mobile ? 'animate-slide-down opacity-0 [animation-fill-mode:forwards]' : 'animate-fade-in'}
        ${
          isActive
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg animate-pulse-gentle'
            : 'text-gray-600 dark:text-gray-300 hover:bg-white/5 dark:hover:bg-white/3 hover:text-indigo-600 dark:hover:text-indigo-300 hover:shadow-md'
        }
      `}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 transition-all duration-500 ${
        isActive ? 'scale-110 rotate-12' : 'group-hover:scale-110 group-hover:rotate-6'
      }`} />
      <span className="truncate">{item.name}</span>
      {isActive && (
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
          <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
        </div>
      )}
    </button>
  )
}

const MobileMenuButton = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="lg:hidden text-gray-600 dark:text-gray-300 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 transform hover:scale-110 flex-shrink-0"
  >
    <div className={`transition-all duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
      {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
    </div>
  </button>
)

const ThemeToggle = ({ isDarkMode, onToggle }: { isDarkMode: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-500 transform hover:scale-110 hover:rotate-12 flex-shrink-0"
  >
    <div className={`transition-all duration-500 ${isDarkMode ? 'rotate-180' : 'rotate-0'}`}>
      {isDarkMode ? <Sun className="h-5 w-5 animate-spin-slow" /> : <Moon className="h-5 w-5" />}
    </div>
  </button>
)

const DesktopSidebar = () => (
  <aside className="hidden lg:flex fixed left-4 top-28 bottom-4 w-72 z-30 animate-slide-in-left">
    <div className="w-full rounded-3xl p-4 backdrop-blur-md bg-white/80 dark:bg-gray-800/70 shadow-2xl ring-1 ring-white/30 dark:ring-black/20 overflow-hidden transform transition-all duration-500 hover:shadow-3xl">
      <nav className="space-y-2 h-full overflow-y-auto">
        {NAVIGATION_ITEMS.map((item, index) => (
          <div key={item.name} style={{ animationDelay: `${index * 100}ms` }} className="animate-fade-in-up">
            <NavLink item={item} index={index} />
          </div>
        ))}
      </nav>
    </div>
  </aside>
)

const MobileSidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <div className={`fixed inset-0 z-50 lg:hidden transition-all duration-500 ${
      isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
    }`}>
      <div 
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-all duration-500 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={onClose} 
      />
      <div className={`absolute left-4 right-4 max-w-sm mx-auto rounded-3xl p-4 bg-white/95 dark:bg-gray-800/95 shadow-2xl ring-1 ring-white/20 dark:ring-black/30 transition-all duration-700 transform ${
        isOpen 
          ? 'top-32 translate-y-0 scale-100 opacity-100' 
          : 'top-20 -translate-y-10 scale-95 opacity-0'
      }`}>
        <nav className="space-y-2 overflow-y-auto max-h-[60vh]">
          {NAVIGATION_ITEMS.map((item, index) => (
            <NavLink 
              key={item.name} 
              item={item} 
              mobile 
              onClick={onClose} 
              index={index}
            />
          ))}
        </nav>
      </div>
    </div>
  )
}

const Header = (props: {
  isMobileMenuOpen: boolean
  onMobileMenuToggle: () => void
  isDarkMode: boolean
  onThemeToggle: () => void
  onLogout: () => void
}) => {
  const { isMobileMenuOpen, onMobileMenuToggle, isDarkMode, onThemeToggle, onLogout } = props

  return (
    <header className="fixed top-4 left-4 right-4 z-40 h-20 animate-slide-down">
      <div className="h-full rounded-3xl backdrop-blur-md bg-white/70 dark:bg-gray-800/70 shadow-xl flex items-center px-4 lg:px-6 transform transition-all duration-500 hover:shadow-2xl hover:scale-[1.02]">
        <div className="flex items-center gap-2 lg:gap-4 min-w-0 flex-1">
          <MobileMenuButton isOpen={isMobileMenuOpen} onClick={onMobileMenuToggle} />
          <div className="hidden lg:block">
            <Logo />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3 animate-slide-in-right">
          <ThemeToggle isDarkMode={isDarkMode} onToggle={onThemeToggle} />
          <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <HeaderDropdowns logout={onLogout} />
          </div>
        </div>
      </div>
    </header>
  )
}

const MainContent = ({ children }: { children?: React.ReactNode }) => (
  <main className="pt-24 pb-4 min-h-screen px-2 lg:ml-80 rounded-2xl">
    <div className="pt-4 pb-1 h-full overflow-auto rounded-2xl">
      {children}
    </div>
  </main>
)

export default function Layout({ children }: { children?: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { logout } = useAuthStore()

  const handleMobileMenuToggle = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const handleMobileMenuClose = () => setIsMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">

      <Header
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={handleMobileMenuToggle}
        isDarkMode={isDarkMode}
        onThemeToggle={toggleDarkMode}
        onLogout={logout}
      />

      <DesktopSidebar />
      <MobileSidebar isOpen={isMobileMenuOpen} onClose={handleMobileMenuClose} />
      <MainContent>{children}</MainContent>
    </div>
  )
}