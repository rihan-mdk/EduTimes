import React, { useState, useEffect } from 'react';
import Lenis from 'lenis';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import AdminTimetable from './pages/AdminTimetable';
import AdminMasterData from './pages/AdminMasterData';
import FacultyDashboard from './pages/FacultyDashboard';
import SplashScreen from './components/SplashScreen';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { user, loading, isAuthenticated } = useAuth();
  const [adminActiveTab, setAdminActiveTab] = useState('timetable'); // 'timetable' | 'masterdata'
  const [splashDone, setSplashDone] = useState(false);

  // Initialize Lenis Smooth Scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, []);

  // Show splash screen on first load (covers auth loading period too)
  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Initializing EduTimes...</p>
      </div>
    );
  }

  // Protected Route: If unauthenticated, always render Login page
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <Navbar activeTab={adminActiveTab} setActiveTab={setAdminActiveTab} />

      {/* Main Content Area - Full canvas matching Navbar width for seamless fit */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {user.role === 'admin' ? (
          <>
            {adminActiveTab === 'timetable' && <AdminTimetable />}
            {adminActiveTab === 'masterdata' && <AdminMasterData />}
          </>
        ) : (
          <FacultyDashboard />
        )}
      </main>
    </div>
  );
}
