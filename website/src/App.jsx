import './App.css'
import { useState } from 'react'
import { AuthProvider }  from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Navbar     from './components/Navbar'
import Hero       from './components/Hero'
import Features   from './components/Features'
import HowItWorks from './components/HowItWorks'
import Pricing    from './components/Pricing'
import Launchers  from './components/Launchers'
import FAQ        from './components/FAQ'
import CTABanner  from './components/CTABanner'
import Footer     from './components/Footer'
import AuthModal  from './components/AuthModal'

export default function App() {
  const [showAuth, setShowAuth] = useState(false)
  return (
    <AuthProvider>
      <ToastProvider>
      <Navbar onSignUp={() => setShowAuth(true)} />
      <main>
        <Hero onSignUp={() => setShowAuth(true)} />
        <Features />
        <HowItWorks />
        <Pricing onSignUp={() => setShowAuth(true)} />
        <Launchers />
        <FAQ />
        <CTABanner onSignUp={() => setShowAuth(true)} />
      </main>
      <Footer />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </ToastProvider>
    </AuthProvider>
  )
}
