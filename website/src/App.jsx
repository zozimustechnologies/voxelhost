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
import MyServer            from './components/MyServer'
import StatusPage          from './components/StatusPage'

export default function App() {
  const [showAuth, setShowAuth]           = useState(false)
  const [page, setPage]                   = useState(() => window.location.hash === '#status' ? 'status' : 'home')
  const [paymentResult, setPaymentResult] = useState(null)
  const [showMyServer, setShowMyServer]   = useState(false)
  return (
    <AuthProvider>
      <ToastProvider>
      {page === 'status' && (
        <StatusPage onBack={() => { setPage('home'); window.location.hash = '' }} />
      )}
      {page === 'confirmed' && (
        <PaymentConfirmation
          onDone={() => { setPage('home'); setPaymentResult(null) }}
          containerId={paymentResult?.containerId}
          expiresAt={paymentResult?.expiresAt}
        />
      )}
      {page === 'failed' && (
        <PaymentFailed
          onRetry={() => setPage('home')}
          onHome={() => setPage('home')}
        />
      )}
      {page === 'home' && (
        <>
        <Navbar onSignUp={() => setShowAuth(true)} onMyServer={() => setShowMyServer(true)} />
        <main>
          <Hero onSignUp={() => setShowAuth(true)} onShowStatus={() => { setPage('status'); window.location.hash = 'status' }} />
          <Features />
          <HowItWorks />
          <Pricing
            onSignUp={() => setShowAuth(true)}
            onPaymentSuccess={(result) => { setPaymentResult(result); setPage('confirmed') }}
            onPaymentFailed={() => setPage('failed')}
            onShowStatus={() => { setPage('status'); window.location.hash = 'status' }}
          />
          <Launchers />
          <FAQ />
          <CTABanner onSignUp={() => setShowAuth(true)} />
        </main>
      <Footer />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showMyServer && <MyServer onClose={() => setShowMyServer(false)} />}
      </>
      )}
      </ToastProvider>
    </AuthProvider>
  )
}
