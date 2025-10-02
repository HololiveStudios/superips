import { useState } from 'react'
import { 
  Menu, X, LayoutGrid, Router, Printer, Box, Moon, Sun, CheckSquare, Settings, Home, Network, Square, Scale as ScaleIcon,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/contexts/theme'
import { HeaderDropdowns } from './PopUp'
import { useNavigationStore } from '@/store/navigation'
import React from 'react'
import {NavigationItem, NavLinkProps} from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

interface ExtendedNavLinkProps extends NavLinkProps {
  index?: number;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Início', href: 'dashboard', icon: Home },
  { name: 'Dispositivos', href: 'devices', icon: LayoutGrid },
  { name: 'Roteadores', href: 'routers', icon: Router },
  { name: 'Impressoras', href: 'printers', icon: Printer },
  { name: 'Caixas', href: 'boxes', icon: Box },
  { name: 'Balanças', href: 'scales', icon: ScaleIcon },
  { name: 'Switches', href: 'switches', icon: Network },
  { name: 'Salas', href: 'room', icon: Square },
  { name: 'Tarefas', href: 'tasks', icon: CheckSquare },
  { name: 'Configurações', href: 'settings', icon: Settings },
]

const Logo = () => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
    className="flex items-center"
  >
    <motion.div 
      whileHover={{ scale: 1.1, rotate: 12 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-md"
    >
      <LayoutGrid className="h-5 w-5 text-white" />
    </motion.div>
    <motion.h1 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="ml-3 text-xl lg:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 truncate"
    >
      Super IPS
    </motion.h1>
  </motion.div>
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
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      whileHover={{ scale: 1.05, x: 20 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-300 mx-2 relative overflow-hidden
        ${isActive
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
          : 'text-gray-600 dark:text-gray-300 hover:bg-white/5 dark:hover:bg-white/3 hover:text-indigo-600 dark:hover:text-indigo-300'}
      `}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <motion.div
        animate={{ rotate: isActive ? [0, -10, 10, 0] : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="relative z-10"
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
      </motion.div>
      <span className="truncate relative z-10">{item.name}</span>
      {isActive && (
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="ml-auto flex items-center gap-1 relative z-10"
        >
          {[0, 200, 400].map((delay, i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ 
                repeat: Infinity, 
                duration: 1, 
                delay: delay / 1000,
                ease: 'easeInOut'
              }}
              className={`bg-white rounded-full ${
                i === 0 ? 'w-2 h-2' : i === 1 ? 'w-1.5 h-1.5 opacity-80' : 'w-1 h-1 opacity-60'
              }`}
            />
          ))}
        </motion.div>
      )}
    </motion.button>
  )
}

const MobileMenuButton = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="lg:hidden text-gray-600 dark:text-gray-300 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300 flex-shrink-0"
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={isOpen ? 'close' : 'open'}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        exit={{ rotate: 90, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </motion.div>
    </AnimatePresence>
  </motion.button>
)

const ThemeToggle = ({ isDarkMode, onToggle }: { isDarkMode: boolean; onToggle: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.1, rotate: 12 }}
    whileTap={{ scale: 0.95 }}
    onClick={onToggle}
    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300 flex-shrink-0"
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={isDarkMode ? 'dark' : 'light'}
        initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 180, opacity: 0, scale: 0.5 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </motion.div>
    </AnimatePresence>
  </motion.button>
)

const DesktopSidebar = () => (
  <motion.aside 
    initial={{ opacity: 0, x: -50 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
    className="hidden lg:flex fixed left-4 top-28 bottom-4 w-72 z-30"
  >
    <motion.div 
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="w-full rounded-3xl p-4 backdrop-blur-md bg-white/80 dark:bg-gray-800/70 shadow-2xl ring-1 ring-white/30 dark:ring-black/20 overflow-hidden"
    >
      <nav className="space-y-2 h-full overflow-y-auto">
        {NAVIGATION_ITEMS.map((item, index) => (
          <NavLink key={item.name} item={item} index={index} />
        ))}
      </nav>
    </motion.div>
  </motion.aside>
)

const MobileSidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 lg:hidden"
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute left-4 right-4 top-32 max-w-sm mx-auto rounded-3xl p-4 bg-white/95 dark:bg-gray-800/95 shadow-2xl ring-1 ring-white/20 dark:ring-black/30"
          >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-4 left-4 right-4 z-40 h-20"
    >
      <motion.div 
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="h-full rounded-3xl backdrop-blur-md bg-white/70 dark:bg-gray-800/70 shadow-xl flex items-center px-4 lg:px-6"
      >
        <div className="flex items-center gap-2 lg:gap-4 min-w-0 flex-1">
          <MobileMenuButton isOpen={isMobileMenuOpen} onClick={onMobileMenuToggle} />
          <div className="hidden lg:block">
            <Logo />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex items-center gap-2 lg:gap-3"
        >
          <ThemeToggle isDarkMode={isDarkMode} onToggle={onThemeToggle} />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <HeaderDropdowns logout={onLogout} />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.header>
  )
}

const MainContent = ({ children, currentPage }: { children?: React.ReactNode, currentPage: string }) => (
  <main className="pt-24 pb-4 min-h-screen px-2 lg:ml-80 rounded-2xl flex flex-col">
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 flex flex-col rounded-2xl overflow-hidden"
      >
        <div className="pt-4 pb-1 h-full overflow-auto">
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  </main>
)


export default function Layout({ children }: { children?: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { logout } = useAuthStore()

  const handleMobileMenuToggle = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const handleMobileMenuClose = () => setIsMobileMenuOpen(false)
  const currentPage = useNavigationStore((state) => state.currentPage)
  
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
      
      <MainContent currentPage={currentPage}>
        {children}
      </MainContent>
    </div>
  )
}