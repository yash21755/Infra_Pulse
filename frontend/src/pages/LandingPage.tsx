import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, ThumbsUp, CheckCircle, MapPin, Shield, Users, FileCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-body selection:bg-brand-200 selection:text-brand-900">
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">IP</div>
          <span className="font-display font-bold text-2xl tracking-tight text-slate-900 dark:text-white">Infra_Pulse</span>
        </div>
        <Link to="/login">
          <Button variant="ghost" className="font-semibold">Sign In</Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 relative z-10">
          <h1 className="text-5xl md:text-7xl font-display font-bold text-slate-900 dark:text-white leading-[1.1]">
            Your Campus.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">Your Voice.</span><br/>
            Fixed.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
            A hyper-local, community-driven platform to report, prioritize, and track infrastructure issues around your college campus.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/login">
              <Button size="lg" className="gap-2 shadow-lg shadow-brand-500/30">
                Report an Issue <span className="font-bold">→</span>
              </Button>
            </Link>
            <Link to="/feed">
              <Button variant="secondary" size="lg">View Live Feed</Button>
            </Link>
          </div>
        </div>
        <div className="relative h-[400px] md:h-[500px] bg-brand-50 dark:bg-brand-500/5 rounded-3xl border border-brand-100 dark:border-brand-500/10 flex items-center justify-center overflow-hidden animate-float">
          {/* Abstract Illustration representation */}
          <div className="absolute w-64 h-64 bg-brand-200 dark:bg-brand-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 top-10 left-10"></div>
          <div className="absolute w-64 h-64 bg-emerald-200 dark:bg-emerald-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 bottom-10 right-10"></div>
          <div className="relative z-10 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-sm w-full mx-8">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl flex items-center justify-center mb-4">
              <MapPin size={32} />
            </div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-6"></div>
            <div className="flex gap-2">
              <div className="h-8 bg-brand-100 dark:bg-brand-500/20 rounded flex-1"></div>
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-12"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="pt-4 md:pt-0"><p className="text-4xl font-display font-bold text-brand-600 dark:text-brand-400 mb-2">1,240</p><p className="text-slate-500 dark:text-slate-400 font-medium">Issues Reported</p></div>
          <div className="pt-4 md:pt-0"><p className="text-4xl font-display font-bold text-brand-600 dark:text-brand-400 mb-2">89%</p><p className="text-slate-500 dark:text-slate-400 font-medium">Resolution Rate</p></div>
          <div className="pt-4 md:pt-0"><p className="text-4xl font-display font-bold text-brand-600 dark:text-brand-400 mb-2">3,200+</p><p className="text-slate-500 dark:text-slate-400 font-medium">Students Engaged</p></div>
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">How It Works</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Three simple steps to a better campus environment.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Camera, title: "1. Spot & Report", desc: "See a broken desk or a leaking pipe? Snap a photo, drop a pin, and post it anonymously." },
            { icon: ThumbsUp, title: "2. Community Votes", desc: "Fellow students upvote the issue. The more votes, the higher it climbs on the priority queue." },
            { icon: CheckCircle, title: "3. Authorities Act", desc: "Campus admins resolve the top issues and post photo proof of the completed work." }
          ].map((step, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 transform origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
              <div className="w-14 h-14 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mb-6">
                <step.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{step.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Designed for Transparency</h2>
            <p className="text-slate-400 text-lg mb-8 leading-relaxed">Infra_Pulse brings Reddit-style democracy to campus maintenance. No more lost emails or ignored complaints.</p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { icon: MapPin, title: "Geo-Tagged Reports", desc: "Exact locations pinpointed on the campus map." },
                { icon: Shield, title: "Anonymous & Safe", desc: "Auto-generated handles protect your identity." },
                { icon: Users, title: "Democratic Prioritization", desc: "Votes determine what gets fixed first." },
                { icon: FileCheck, title: "Proof of Resolution", desc: "Admins upload photo proof when jobs are done." }
              ].map((feat, i) => (
                <div key={i}>
                  <feat.icon className="text-brand-400 mb-3" size={24} />
                  <h4 className="font-bold text-white mb-2">{feat.title}</h4>
                  <p className="text-slate-400 text-sm">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-purple-600 rounded-3xl transform rotate-3 opacity-50 blur-lg"></div>
            <div className="relative bg-slate-800 border border-slate-700 rounded-3xl p-8 h-full flex flex-col justify-center">
               <div className="space-y-4">
                  {/* Mock Feed Item */}
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex gap-4">
                     <div className="flex flex-col items-center gap-1 text-slate-400">
                        <ThumbsUp size={16} className="text-brand-400" />
                        <span className="text-sm font-bold text-white">245</span>
                     </div>
                     <div>
                        <h4 className="text-white font-bold mb-1">Library AC completely broken</h4>
                        <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded-full">Critical</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 text-center py-8">
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Built by students, for students.</p>
      </footer>
    </div>
  );
};