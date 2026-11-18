import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  ShieldCheck, 
  HelpCircle, 
  Code2, 
  X, 
  ExternalLink, 
  Mail, 
  Github, 
  Linkedin, 
  Globe, 
  Check, 
  Copy, 
  Sparkles, 
  Database, 
  Lock, 
  BookOpen, 
  Calendar, 
  Clock, 
  Users, 
  Award, 
  Cpu,
  GraduationCap
} from 'lucide-react';

export default function Footer({ variant = 'light' }) {
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy' | 'developer' | 'help' | null
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    if (activeModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [activeModal]);

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const isDark = variant === 'dark' || variant === 'glass';

  return (
    <>
      <footer
        className={`w-full transition-colors select-none ${
          isDark
            ? 'border-t border-white/10 bg-slate-950/70 backdrop-blur-md text-white/70 py-4 px-4 sm:px-8 mt-auto'
            : 'border-t border-slate-200/80 bg-white/80 backdrop-blur-sm text-slate-600 py-5 px-4 sm:px-8 mt-auto shadow-xs'
        }`}
      >
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          {/* Left: Brand & Institution */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              E
            </div>
            <div>
              <span className={`font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Edu<span className="text-orange-500">Times</span>
              </span>
              <span className="mx-2 text-slate-400">•</span>
              <span className={isDark ? 'text-white/60' : 'text-slate-500'}>
                Department of AIML, Yenepoya Institute of Technology
              </span>
            </div>
          </div>

          {/* Center: Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium">
            <button
              type="button"
              onClick={() => setActiveModal('terms')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark ? 'hover:text-orange-400 text-white/80' : 'hover:text-orange-600 text-slate-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-orange-500" />
              <span>Terms & Conditions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark ? 'hover:text-orange-400 text-white/80' : 'hover:text-orange-600 text-slate-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Privacy Policy</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('help')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark ? 'hover:text-orange-400 text-white/80' : 'hover:text-orange-600 text-slate-600'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
              <span>Help & Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('developer')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                isDark
                  ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border border-orange-500/30'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-orange-600" />
              <span>About Developer</span>
            </button>
          </div>

          {/* Right: Copyright */}
          <div className={`text-[11px] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
            &copy; {new Date().getFullYear()} EduTimes. Engineered by <span className={`font-semibold ${isDark ? 'text-white/70' : 'text-slate-700'}`}>Muhammed Rihan MR</span>.
          </div>
        </div>
      </footer>

      {/* Interactive Modal System */}
      {activeModal && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-150">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveModal(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div 
              className="relative w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all border border-slate-200 my-8 flex flex-col max-h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xs">
                    {activeModal === 'terms' && <FileText className="w-4 h-4" />}
                    {activeModal === 'privacy' && <ShieldCheck className="w-4 h-4" />}
                    {activeModal === 'help' && <HelpCircle className="w-4 h-4" />}
                    {activeModal === 'developer' && <Code2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {activeModal === 'terms' && 'Terms and Conditions'}
                      {activeModal === 'privacy' && 'Privacy Policy & Data Protection'}
                      {activeModal === 'help' && 'EduTimes Documentation & User Guide'}
                      {activeModal === 'developer' && 'About the Developer'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      EduTimes Academic Suite • Yenepoya Institute of Technology
                    </p>
                  </div>
                </div>

                {/* Tab Switcher in Header */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
                    title="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Navigation Tabs inside modal */}
              <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-slate-100 bg-white overflow-x-auto text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveModal('terms')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeModal === 'terms'
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Terms & Conditions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('privacy')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeModal === 'privacy'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('help')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeModal === 'help'
                      ? 'bg-sky-50 text-sky-600 border border-sky-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Help & Guide
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('developer')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeModal === 'developer'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  About Developer (Me)
                </button>
              </div>

              {/* Modal Body with Scroll */}
              <div className="px-6 py-5 overflow-y-auto text-slate-700 text-xs leading-relaxed space-y-4">
                {/* 1. TERMS & CONDITIONS CONTENT */}
                {activeModal === 'terms' && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-orange-50/60 border border-orange-100 rounded-xl text-orange-900">
                      <p className="font-semibold text-xs">Academic Integrity & Official Deployment</p>
                      <p className="text-[11px] mt-0.5 text-orange-800">
                        EduTimes is engineered as an automated conflict-free timetable scheduling and academic master data management suite for Yenepoya Institute of Technology. Use of this platform constitutes agreement with institutional operational guidelines.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">1. Institutional Purpose & Scope</h4>
                      <p>
                        EduTimes provides mathematical constraint satisfaction solving (CSP) for higher education timetable generation, faculty workload balance, classroom allotment, and syllabus scheduling compliant with VTU and institutional academic regulations.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">2. Role-Based Access & Accountability</h4>
                      <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600">
                        <li><strong>Department Administrators:</strong> Responsible for initializing academic years, maintaining accurate subject hours, enforcing teacher allocations, and reviewing generated timetable drafts.</li>
                        <li><strong>Faculty Members:</strong> Responsible for maintaining valid credentials, logging legitimate university/research external commitments, and submitting course preferences in good faith.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">3. Multi-Tenant Departmental Isolation</h4>
                      <p>
                        Each academic department (AIML, CSE, ECE, ME, etc.) operates under strict logical multi-tenancy. Accessing, altering, or attempting to expose cross-departmental data without administrative clearance is strictly prohibited by system security controls.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">4. Schedule Validation & Sign-Off Clause</h4>
                      <p>
                        While EduTimes employs advanced conflict-detection algorithms to prevent room clashes, faculty overlaps, and back-to-back theory burnout, all computer-generated timetables must undergo formal institutional review and signature verification by the <strong>Time Table Co-ordinator</strong>, <strong>Head of the Department (HOD)</strong>, and <strong>Principal</strong> prior to semester dissemination.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">5. Modifications & Software Updates</h4>
                      <p>
                        The development team reserves the right to improve scheduler heuristics, refine solver constraints, and patch security layers to maintain optimum uptime and schedule compliance.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. PRIVACY POLICY CONTENT */}
                {activeModal === 'privacy' && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl text-emerald-900">
                      <p className="font-semibold text-xs">Real Data Handling & Protection Commitment</p>
                      <p className="text-[11px] mt-0.5 text-emerald-800">
                        EduTimes respects your privacy and is dedicated to securing institutional data. Below is the precise disclosure of the exact information stored, processed, and maintained in this application.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-emerald-600" />
                        1. Specific Data Stored by EduTimes
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="font-bold text-slate-800">Academic Master Data</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Department names and codes, semester numbers, classroom/lab room designations, course codes, course names, weekly lecture credit hours, lab durations, and integrated block sessions.
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="font-bold text-slate-800">Faculty Profiles & Workload</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Faculty full names, faculty codes (e.g. F01, F02), department memberships, assigned roles (`admin` or `faculty`), course preferences, and mentorship duties.
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="font-bold text-slate-800">Commitments & Unavailability</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            External busy periods, university examination duties, or research slots flagged by faculty to prevent automatic scheduling during those times.
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                          <p className="font-bold text-slate-800">Generated Timetable Entries</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Day-of-week, period numbers, timeslot timestamps (09:00 - 16:15), classroom assignments, subject ID mappings, and faculty assignments.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        2. Cryptographic Security & Passwords
                      </h4>
                      <p>
                        Passwords are <strong>never stored in plaintext</strong>. EduTimes uses standard one-way salted <code>bcrypt</code> cryptographic hashing algorithms. Neither department administrators nor software maintainers have access to raw faculty passwords.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">3. Session & Browser Storage</h4>
                      <p>
                        EduTimes uses JSON Web Tokens (JWT) stored strictly within the client browser’s <code>localStorage</code> to maintain authenticated sessions. Tokens expire automatically and are purged upon clicking "Logout".
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">4. Zero Commercial Tracking or Advertising</h4>
                      <p>
                        EduTimes contains <strong>no third-party tracking scripts, no behavioral analytics pixels, and zero advertising beacons</strong>. Institutional academic data is hosted on secure PostgreSQL instances on Supabase with SSL/TLS encryption in transit and at rest.
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. HELP & DOCUMENTATION CONTENT */}
                {activeModal === 'help' && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl text-sky-900">
                      <p className="font-semibold text-xs">EduTimes Operation & Quick Reference</p>
                      <p className="text-[11px] mt-0.5 text-sky-800">
                        Follow this step-by-step workflow to generate clash-free institutional schedules and export official VTU-formatted timetables.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          1
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Configure Master Data</p>
                          <p className="text-[11px] text-slate-500">
                            Navigate to <strong>Master Data</strong>. Ensure semesters (3, 5, 7) have their assigned classrooms (e.g. LLH-04). Add subjects, specify weekly hours, and designate if a course is a Theory subject, 2-Hour Lab, Integrated Block, or Generic Activity (Library/Sports).
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          2
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Subject Allotment & Preferences</p>
                          <p className="text-[11px] text-slate-500">
                            Use the <strong>Allotment</strong> tab to initialize a semester course allotment session. Faculty members can submit priority preferences for subjects they specialize in, and administrators can finalize teaching faculty allocations.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          3
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Log External Faculty Commitments</p>
                          <p className="text-[11px] text-slate-500">
                            If a faculty member has university obligations, guest lectures, or departmental duties on specific days or hours, record them under <strong>External Commitments</strong> to prevent classes from being scheduled in those periods.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          4
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Generate Intelligent Timetable</p>
                          <p className="text-[11px] text-slate-500">
                            Click <strong>Auto Generate Timetable</strong>. The scheduler automatically enforces key constraints:
                            <br />• <strong>No Consecutive Theory Hours:</strong> Faculty teaching theory in Period 1 will not have Period 2 on that day (1-hour gap preserved across periods).
                            <br />• <strong>Labs in Periods 3–7:</strong> Laboratory practicals are strictly scheduled in the afternoon/mid-day slots and never in the first morning hour.
                            <br />• <strong>Zero Clashes:</strong> Complete room, faculty, and semester conflict resolution.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          5
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Export Official Word File</p>
                          <p className="text-[11px] text-slate-500">
                            Click <strong>Export Word (.doc)</strong> to download the publication-ready timetable featuring the institutional header, subject code legend, faculty in-charge list, class advisor mentors, and the 3 official signature blocks (Time Table Co-ordinator, HOD, and Principal) formatted to fit on one landscape page.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. ABOUT DEVELOPER (ME) CONTENT */}
                {activeModal === 'developer' && (
                  <div className="space-y-5">
                    {/* Hero Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white relative overflow-hidden border border-slate-800 shadow-xl">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        {/* Avatar */}
                        <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 p-0.5 shadow-lg shadow-orange-500/20 shrink-0">
                          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-extrabold text-2xl text-transparent bg-clip-text bg-gradient-to-tr from-orange-400 to-amber-300">
                            MR
                          </div>
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                            <h3 className="text-lg font-bold tracking-tight text-white">
                              Muhammed Rihan MR
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              Full Stack Developer | AIML Student
                            </span>
                          </div>

                          <p className="text-xs text-orange-200/90 font-medium">
                            Department of AIML, Yenepoya Institute of Technology
                          </p>

                          <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-xl">
                            Passionate software engineer specializing in building modern web applications, e-commerce websites and developing solutions that improve our society.
                          </p>

                          {/* Social Connect Badges */}
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
                            <a
                              href="https://github.com/rihan-mdk"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer border border-white/10"
                            >
                              <Github className="w-3.5 h-3.5 text-slate-300" />
                              <span>GitHub</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>

                            <a
                              href="https://www.linkedin.com/in/mohammad-rihan-m-r"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 text-xs font-medium transition cursor-pointer border border-blue-500/30"
                            >
                              <Linkedin className="w-3.5 h-3.5 text-blue-400" />
                              <span>LinkedIn</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>

                            <a
                              href="http://rihan-s-portfolio.vercel.app/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-200 text-xs font-medium transition cursor-pointer border border-emerald-500/30"
                            >
                              <Globe className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Portfolio</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleCopyEmail('rihanatwork26@gmail.com')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/30 hover:bg-orange-600/40 text-orange-200 text-xs font-medium transition cursor-pointer border border-orange-500/30"
                              title="Click to copy email"
                            >
                              <Mail className="w-3.5 h-3.5 text-orange-400" />
                              <span>rihanatwork26@gmail.com</span>
                              {copiedEmail ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Developer Perspective / Quote */}
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 relative">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                            Developer's Perspective
                          </p>
                          <blockquote className="italic text-xs text-amber-900 leading-relaxed font-serif">
                            “An engineer, in my perspective, is not merely someone who solves big or complex problems. An engineer is someone who observes the world around them, identifies even the smallest inconveniences in everyday life, and takes the initiative to turn those observations into meaningful solutions. Because true engineering isn't just about solving major challenges; it's about making everyday life better.”
                          </blockquote>
                          <p className="text-[10px] text-amber-700 font-bold text-right mt-1.5">
                            — Muhammed Rihan MR
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mentorship & Guidance Credit */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50/90 via-amber-50/80 to-orange-50/90 border border-orange-200 text-slate-800 relative">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200/70 mt-0.5 shadow-xs">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-800">
                              Faculty Mentorship & Guidance
                            </span>
                            <span className="text-orange-300">•</span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Acknowledgement</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            Developed with profound gratitude under the invaluable mentorship and esteemed guidance of <strong className="text-slate-900 font-bold">Prof. Safmeena</strong>, whose continuous support, technical insights, and constant encouragement provided the cornerstone for architecting and successfully realizing this automated institutional scheduling solution.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Technical Competencies & Foundation */}
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-orange-500" />
                        Core Engineering & Technical Skills
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                          <p className="text-xs font-bold text-slate-800">Python</p>
                          <p className="text-[10px] text-slate-500">AI / ML / Scripting</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                          <p className="text-xs font-bold text-slate-800">C Language</p>
                          <p className="text-[10px] text-slate-500">Systems & Logic</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                          <p className="text-xs font-bold text-slate-800">Full Stack Web</p>
                          <p className="text-[10px] text-slate-500">React • Node • Express</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                          <p className="text-xs font-bold text-slate-800">PostgreSQL / Supabase</p>
                          <p className="text-[10px] text-slate-500">Database & Algorithms</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-slate-50/70 text-[11px] text-slate-500">
                <span>EduTimes Academic Suite • v1.0.0 Production</span>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-1.5 rounded-lg font-semibold text-white bg-slate-800 hover:bg-slate-900 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
