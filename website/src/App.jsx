import './App.css'
import { AuthProvider } from './context/AuthContext'
import Navbar     from './components/Navbar'
import Hero       from './components/Hero'
import Features   from './components/Features'
import HowItWorks from './components/HowItWorks'
import Pricing    from './components/Pricing'
import Launchers  from './components/Launchers'
import FAQ        from './components/FAQ'
import CTABanner  from './components/CTABanner'
import Footer     from './components/Footer'

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Launchers />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </AuthProvider>
  )
}
