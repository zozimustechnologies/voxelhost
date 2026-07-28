import './App.css'
import { useState } from 'react'
import { AuthProvider }  from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Navbar              from './components/Navbar'
import Hero                from './components/Hero'
import Features            from './components/Features'
import HowItWorks          from './components/HowItWorks'
import Pricing             from './components/Pricing'
import Launchers           from './components/Launchers'
import FAQ                 from './components/FAQ'
import CTABanner           from './components/CTABanner'
import Footer              from './components/Footer'
import AuthModal           from './components/AuthModal'
import PaymentConfirmation from './components/PaymentConfirmation'
import PaymentFailed       from './components/PaymentFailed'

export default function App() {
  const [showAuth, setShowAuth] = useState(false)
  const [page, setPage]         = useState('home') // 'home' | 'confirmed' | 'failed'
  return (
    <AuthProvider>
      <ToastProvider>
      {page === 'confirmed' && (
        <PaymentConfirmation onDone={() => setPage('home')} />
      )}
      {page === 'failed' && (
        <PaymentFailed
          onRetry={() => setPage('home')}
          onHome={() => setPage('home')}
        />
      )}
      {page === 'home' && (
        <>
        <Navbar onSignUp={() => setShowAuth(true)} />
        <main>
          <Hero onSignUp={() => setShowAuth(true)} />
          <Features />
          <HowItWorks />
          <Pricing
            onSignUp={() => setShowAuth(true)}
            onPaymentSuccess={() => setPage('confirmed')}
            onPaymentFailed={() => setPage('failed')}
          />
          <Launchers />
          <FAQ />
          <CTABanner onSignUp={() => setShowAuth(true)} />
        </main>
      <Footer />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
      )}
      </ToastProvider>
    </AuthProvider>
  )
}
