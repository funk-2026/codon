import React, { useState } from 'react';
import { 
  ChevronDown, 
  HelpCircle, 
  MessageCircle, 
  Heart, 
  Stethoscope, 
  Target, 
  UserCheck, 
  ShieldCheck,
  Mail,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './Header';
import logo from './assets/logo.png';

// FAQ Data Object

const CodonLogo = ({ className = "h-8" }) => (
  <div className={`flex items-center ${className}`}>
    <img
      src={logo}
      alt="Logo"
      className="h-full w-auto object-contain"
    />
  </div>
);
const faqData = [
  {
    id: 1,
    icon: <Stethoscope size={20} />,
    question: "What is Codon Classes, and who can join it?",
    answer: "Codon Classes is a learning and mentorship platform created by doctors to guide students preparing for NEET UG. It focuses on building strong concepts, smart study strategies, discipline, and consistent motivation to help students achieve their dream of becoming doctors. Founded by Dr. Yogesh Desarda, a General and Laparoscopic Surgeon, it supports average and below-average students. Any student preparing for NEET UG — whether starting early or taking a drop year — can join."
  },
  {
    id: 2,
    icon: <Target size={20} />,
    question: "How is Codon Classes different from other NEET UG coaching programs?",
    answer: "Codon is doctor-led. It's designed by surgeons and physicians based on their personal experiences from NEET UG to Residency. Unlike conventional coaching that focuses only on syllabus, we emphasize conceptual clarity over rote learning, personalized doctor-mentorship, and 'Codon's Strategy' (what/how much to study and revise daily). It's built to transform students' mindsets, not just their marks."
  },
  {
    id: 3,
    icon: <HelpCircle size={20} />,
    question: "What teaching approach does Codon Classes follow?",
    answer: "We follow a 'Concept-First' approach aligned with NCERT. This includes simplified concept explanations, step-by-step problem-solving techniques, regular performance analysis, and smart study plans. We also provide mindset training to reduce exam stress and build the confidence needed to tackle NEET-level questions."
  },
  {
    id: 4,
    icon: <UserCheck size={20} />,
    question: "Who should join Codon Classes? Is it only for toppers?",
    answer: "No, it is for everyone! We specifically focus on below-average and average students who need structured guidance. If you are struggling with consistency, feel lost without mentorship, or are a drop-year student aiming for better results, Codon is for you. We believe every dedicated student can become a doctor with the right strategy."
  },
  {
    id: 5,
    icon: <ShieldCheck size={20} />,
    question: "What kind of mentorship and support do students receive?",
    answer: "Students get direct guidance from doctors, personalized study planning based on their strengths, regular progress tracking, and doubt-solving support. We ensure no student feels unsupported academically or emotionally during their journey."
  },
  {
    id: 6,
    icon: <Heart size={20} className="text-red-500" />,
    question: "What is MMM (Mind Mentor Mitra) and why was it created?",
    answer: "MMM is a mental well-being initiative. Preparing for NEET or MBBS is mentally demanding. We created MMM to provide a safe space for students and resident doctors to share concerns, manage stress, anxiety, and burnout. It ensures that mental health is given equal importance as academic success."
  },
  {
    id: 7,
    icon: <MessageCircle size={20} />,
    question: "Who can benefit from MMM (Mind Mentor Mitra)?",
    answer: "NEET UG/PG aspirants, MBBS students facing burnout, resident doctors dealing with fatigue, or anyone in the healthcare professional journey feeling overwhelmed. It's for anyone who needs emotional balance while pursuing high-pressure goals."
  },
  {
    id: 8,
    icon: <Heart size={20} />,
    question: "What kind of support does MMM provide?",
    answer: "We provide one-to-one mentorship, stress management strategies, mindset coaching, and confidential listening support. We focus on building emotional resilience during exam pressure or phases of self-doubt."
  },
  {
    id: 9,
    icon: <ShieldCheck size={20} />,
    question: "Is the support provided by MMM confidential?",
    answer: "Absolutely. Confidentiality is our core value. All personal concerns are treated with respect and privacy. We strive to create a non-judgmental environment where you can open up freely."
  },
  {
    id: 10,
    icon: <Phone size={20} />,
    question: "How can someone join or reach out to Codon or MMM?",
    answer: "You can reach out through our official contact channels (WhatsApp or Email). Whether you want to start NEET preparation or just need someone to talk to in a supportive environment, our team will guide you through the next steps."
  }
];

const FAQItem = ({ item, isOpen, toggleOpen }) => {
  return (
    <div className={`mb-4 overflow-hidden transition-all duration-300 border ${isOpen ? 'border-[#5bc5d4] bg-white shadow-lg' : 'border-slate-200 bg-white/50'} rounded-2xl`}>
      <button
        onClick={toggleOpen}
        className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-[#5bc5d4] text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
            {item.icon}
          </div>
          <span className={`font-bold transition-colors ${isOpen ? 'text-[#1a7a85]' : 'text-slate-700'}`}>
            {item.question}
          </span>
        </div>
        <ChevronDown 
          className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#5bc5d4]' : ''}`} 
          size={20} 
        />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 pt-0 text-slate-600 leading-relaxed border-t border-slate-50">
              <div className="pl-12">
                {item.answer}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQ = () => {
  const [openId, setOpenId] = useState(1);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 overflow-hidden bg-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(#5bc5d4_1px,transparent_1px)] [background-size:24px_24px] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-[#f0f9fa] text-[#1a7a85] px-4 py-2 rounded-full mb-6 shadow-sm border border-[#5bc5d4]/20">
            <HelpCircle size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Support Center</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
            Frequently Asked <span className="text-[#5bc5d4]">Questions</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Everything you need to know about Codon Classes and Mind Mentor Mitra (MMM). 
            Can't find the answer? Reach out to our team.
          </p>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex flex-col">
          {faqData.map((faq) => (
            <FAQItem 
              key={faq.id} 
              item={faq} 
              isOpen={openId === faq.id} 
              toggleOpen={() => setOpenId(openId === faq.id ? null : faq.id)}
            />
          ))}
        </div>
      </section>

      {/* CTA / Contact Support */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="bg-[#1a7a85] rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 relative z-10">Still have questions?</h2>
          <p className="text-teal-50/80 mb-8 relative z-10">We are here to help you 24/7. Connect with our mentors now.</p>
          <div className="flex flex-wrap justify-center gap-4 relative z-10">
            <a 
              href="https://wa.me/9987134790" 
              target="_blank" 
              className="bg-[#25D366] hover:bg-[#1fae53] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all transform hover:-translate-y-1"
            >
              <MessageCircle size={20} />
              Chat on WhatsApp
            </a>
            {/* <a 
              href="mailto:codonneetug@gmail.com" 
              className="bg-white text-[#1a7a85] hover:bg-teal-50 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all transform hover:-translate-y-1 shadow-lg"
            >
              <Mail size={20} />
              Email Support
            </a> */}
          </div>
        </div>
      </section>

      {/* Footer Copy */}
      <footer className="bg-gray-900 py-12 text-center text-white">
        <div className="flex justify-center mb-4 opacity-80">
          <CodonLogo />
        </div>
        <p className="text-gray-500 text-sm">© 2026 codon Academy</p>
      </footer>
    </div>
  );
};

export default FAQ;