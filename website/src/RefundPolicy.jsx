import React from 'react';
import { 
  ShieldAlert, 
  RotateCcw, 
  Ban, 
  CheckCircle2, 
  Info, 
  Mail, 
  Phone, 
  Globe, 
  FileText,
  Clock,
  AlertCircle
} from 'lucide-react';
import Header from './Header';
import logo from './assets/logo.png';

const PolicySection = ({ icon: Icon, title, children, highlight }) => (
  <div className={`mb-10 p-8 rounded-[2rem] border ${highlight ? 'bg-[#f0f9fa] border-[#5bc5d4]/30' : 'bg-white border-slate-100 shadow-sm'}`}>
    <div className="flex items-center gap-4 mb-6">
      <div className={`p-3 rounded-xl ${highlight ? 'bg-[#1a7a85] text-white' : 'bg-slate-100 text-[#1a7a85]'}`}>
        <Icon size={24} />
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{title}</h2>
    </div>
    <div className="text-slate-600 leading-relaxed space-y-4 ml-2 md:ml-14">
      {children}
    </div>
  </div>
);
 // Aapne logo path check kar lein




/* SAME LOGO COMPONENT */

const CodonLogo = ({ className = "h-8" }) => (
  <div className={`flex items-center ${className}`}>
    <img
      src={logo}
      alt="Logo"
      className="h-full w-auto object-contain"
    />
  </div>
);


const RefundPolicy = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <Header />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 pb-12 overflow-hidden bg-white border-b border-slate-100">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(#5bc5d4_1px,transparent_1px)] [background-size:24px_24px] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
            <ShieldAlert size={16} className="text-[#1a7a85]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Legal Documents</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            Refund & <span className="text-[#5bc5d4]">Cancellation</span> Policy
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm text-slate-400 font-medium">
            <span className="flex items-center gap-1"><Clock size={14} /> Last Updated: Feb 2026</span>
            <span>•</span>
            <span>Codon Classes & MMM</span>
          </div>
        </div>
      </section>

      {/* --- CONTENT SECTION --- */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        
        {/* 1. Introduction */}
        <PolicySection icon={Info} title="1. Introduction">
          <p>
            This Refund and Cancellation Policy outlines the terms under which payments made for courses, mentorship programs, or services offered by <strong>Codon Classes</strong> and <strong>MMM (Mind Mentor Mitra)</strong> may be cancelled or refunded.
          </p>
          <p className="font-medium text-slate-800 italic">
            By enrolling in our programs or purchasing our services, you agree to this policy.
          </p>
        </PolicySection>

        {/* 2. General Policy - Highlighted */}
        <PolicySection icon={CheckCircle2} title="2. General Policy" highlight>
          <p>
            All purchases made for courses, mentorship programs, study materials, or services are considered final.
          </p>
          <p>
            Due to the <strong>digital nature</strong> of our content and immediate access to learning materials, refunds are generally not applicable once access has been granted.
          </p>
        </PolicySection>

        {/* 3 & 4. Cancellation & Eligibility */}
        <PolicySection icon={RotateCcw} title="3. Cancellation & Eligibility">
          <h3 className="font-bold text-slate-800 mt-2 underline decoration-[#5bc5d4] underline-offset-4">Cancellation Rule:</h3>
          <p>Users may request cancellation only <strong>before</strong> access to course content or services has been granted.</p>
          
          <h3 className="font-bold text-slate-800 mt-6 underline decoration-[#5bc5d4] underline-offset-4">Eligibility for Refund:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Duplicate payment made due to technical error.</li>
            <li>Payment made but access not provided within a reasonable time.</li>
            <li>Transaction failure where amount is deducted but service not activated.</li>
            <li>Cancellation requested before access activation.</li>
          </ul>
        </PolicySection>

        {/* 5. Non-Refundable - Red Alert Style */}
        <div className="mb-10 p-8 rounded-[2rem] border border-red-100 bg-red-50/30 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-red-500 text-white shadow-lg shadow-red-200">
              <Ban size={24} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">4. Non-Refundable Situations</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 ml-2 md:ml-14 text-sm font-medium text-slate-600">
            {[
              "Change of mind after enrollment",
              "Lack of usage of services",
              "Dissatisfaction due to personal expectations",
              "Failure to clear exams",
              "Partial use of course or mentorship",
              "Missed sessions or inactivity",
              "Technical issues at user's device",
              "Violation of terms or misconduct"
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* 6. MMM Sessions */}
        <PolicySection icon={AlertCircle} title="5. MMM Mentorship Sessions">
          <p>
            Fees paid for mentorship sessions under <strong>MMM (Mind Mentor Mitra)</strong> are non-refundable once the session has been scheduled or conducted.
          </p>
          <p>Rescheduling may be allowed subject to availability and at least 24-hour prior notice.</p>
        </PolicySection>

        {/* 7 & 8. Process & Transfers */}
        <PolicySection icon={FileText} title="6. Refund Process & Transfers">
          <p><strong>Process:</strong> If eligible, refunds will be processed within <strong>7–14 working days</strong> through the original payment method.</p>
          <p><strong>Transfers:</strong> Course enrollments are <strong>non-transferable</strong> and cannot be transferred to another user or future batch unless explicitly approved by Codon Classes.</p>
        </PolicySection>

        {/* 11. Contact Info Card */}
        <div className="mt-16 bg-[#1a7a85] rounded-[3rem] p-10 md:p-14 text-white text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          
          <h2 className="text-3xl font-bold mb-6">Need a Refund Request?</h2>
          <p className="text-teal-50/80 mb-10 max-w-xl mx-auto">
            In rare or genuine cases, requests may be reviewed individually. Our management's decision remains final.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6">
            <a href="mailto:codonneetug@gmail.com" className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl border border-white/10 transition-all">
              <Mail size={18} className="text-[#5bc5d4]" />
              <span className="font-bold">codonneetug@gmail.com</span>
            </a>
            <a href="tel:+919987134790" className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl border border-white/10 transition-all">
              <Phone size={18} className="text-[#5bc5d4]" />
              <span className="font-bold">+91 9987134790</span>
            </a>
          </div>
          
          <div className="mt-10 pt-10 border-t border-white/10 flex flex-col items-center">
             <Globe size={20} className="mb-2 opacity-50" />
             <p className="text-xs tracking-widest uppercase opacity-60 font-bold">www.codonneetug.com</p>
          </div>
        </div>

      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-gray-900 py-12 text-center text-white">
        <div className="flex justify-center mb-4 opacity-80">
          <CodonLogo />
        </div>
        <p className="text-gray-500 text-sm">© 2026 codon Academy</p>
      </footer>
    </div>
  );
};

export default RefundPolicy;