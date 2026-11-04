import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, BookOpen, BarChart2, Smartphone, Code, ArrowRight,Settings  } from 'lucide-react';

const LandingPage = () => {
  
  // Animation Variants
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      
      {/* 1. NAVBAR */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#1a7a85] text-white sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold tracking-tighter italic">CODON</div>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <a href="#" className="hover:opacity-80">NEET PG</a>
            <a href="#" className="hover:opacity-80">Plans</a>
            <a href="#" className="hover:opacity-80">Careers</a>
            <a href="#" className="hover:opacity-80">Contact</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-[#5bc5d4] px-6 py-2 rounded-md font-bold hover:bg-[#4eb3c1] transition">
            Dashboard
          </button>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative bg-gradient-to-b from-[#1a7a85] to-[#7bcbd4] pt-20 pb-32 text-center text-white px-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-6 flex justify-center"
        >
          {/* Logo Placeholder */}
          <div className="w-20 h-20 border-4 border-yellow-400 rounded-full flex items-center justify-center font-bold text-3xl">M</div>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-bold mb-8"
        >
          The Gold Standard for NEET PG - NExT
        </motion.h1>

        <div className="flex flex-col items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#5bc5d4] px-10 py-4 rounded-lg text-xl font-bold shadow-lg"
          >
            Go to dashboard
          </motion.button>
          <a href="#" className="underline text-sm opacity-90">View Plans &gt;</a>
        </div>
      </section>

      {/* 3. FEATURE: QBank */}
{/* UPDATED ABOUT SECTION: codeON Philosophy */}
{/* <section className="py-20 px-6 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center"> */}
  
  <motion.div 
    initial={{ opacity: 0, x: -50 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8 }}
    className="order-2 md:order-1"
  >
    <div className="relative group">
      {/* Glow effect behind image */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#34b3c1] to-[#1a7a85] rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
      <img 
        src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
        alt="Coding Workspace" 
        className="relative rounded-xl shadow-2xl border border-gray-100"
      />
    </div>
  </motion.div>

 

{/* </section> */}

{/* 5. WHY codeON SECTION (Replaces the old Test Series Section) */}
<section className="py-24 px-6 bg-white">
  <div className="max-w-6xl mx-auto">
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center mb-16"
    >
      <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
        The <span className="text-[#1a7a85]">codeON</span> Advantage
      </h2>
      <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
        Moving beyond rote memorization to a conceptual ecosystem designed by India's top rankers and most loved faculty.
      </p>
    </motion.div>

    <div className="grid md:grid-cols-3 gap-8">
      {/* 1. Concept & Content Quality */}
      <motion.div 
        {...fadeInUp}
        className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow"
      >
        <div className="w-12 h-12 bg-[#1a7a85] rounded-lg flex items-center justify-center text-white mb-6">
          <BookOpen size={28} />
        </div>
        <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Evidence-Based Learning</h3>
        <p className="text-gray-600 leading-relaxed text-sm">
          Every MCQ and video is structured for <strong>Concept-based learning</strong>. Our peer-reviewed, error-free content is backed by the latest standard textbooks, ensuring you master high-yield topics before memorizing facts.
        </p>
      </motion.div>

      {/* 2. Active Solving & Customization */}
      <motion.div 
        {...fadeInUp}
        className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow"
      >
        <div className="w-12 h-12 bg-[#34b3c1] rounded-lg flex items-center justify-center text-white mb-6">
          <Settings size={28} />
        </div>
        <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Active Solving vs Reading</h3>
        <p className="text-gray-600 leading-relaxed text-sm">
          Don't just read; <strong>SOLVE</strong>. Master the art of educated guessing and negative marking management. Create your own <strong>Custom Modules</strong> by filtering difficulty, tags like #RecentUpdates, or your bookmarked errors.
        </p>
      </motion.div>

      {/* 3. Competitive Readiness */}
      <motion.div 
        {...fadeInUp}
        className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow"
      >
        <div className="w-12 h-12 bg-[#5bc5d4] rounded-lg flex items-center justify-center text-white mb-6">
          <BarChart2 size={28} />
        </div>
        <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Pan-India Simulation</h3>
        <p className="text-gray-600 leading-relaxed text-sm">
          Be part of the <strong>Largest Test Series</strong> in India. Experience real-time exam simulations with in-depth analytics that provide an accurate All-India Rank, prepared in collaboration with the top 20% of rank holders.
        </p>
      </motion.div>
    </div>

    {/* Mixed Paragraph Highlight */}
    <motion.div 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      className="mt-16 bg-gradient-to-r from-[#1a7a85] to-[#34b3c1] p-1 rounded-2xl"
    >
      <div className="bg-white p-8 md:p-12 rounded-[14px]">
        <p className="text-lg md:text-xl text-gray-700 leading-relaxed italic text-center font-medium">
          "At codeON, we combine the expertise of India's most loved teachers with high-probability MCQs to make you exam-ready. By shifting from passive reading to active, evidence-based solving with custom performance analytics, we ensure you don't just study—you compete at the highest level."
        </p>
      </div>
    </motion.div>
  </div>
</section>

      {/* 4. FEATURE: Video Classes */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeInUp}>
            <div className="text-[#34b3c1] mb-4"><PlayCircle size={48} /></div>
            <h2 className="text-4xl font-bold mb-6">Recorded <span className="text-[#34b3c1]">Video</span> Classes by India's top faculty</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Integrated conceptual content across all 19 subjects. Includes animations & real clinical scenarios for better understanding.
            </p>
          </motion.div>
          <motion.div {...fadeInUp} className="relative">
             <div className="bg-white p-4 rounded-xl shadow-xl">
                <img src="https://via.placeholder.com/500x300" alt="Video" className="rounded-lg w-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/20 p-4 rounded-full backdrop-blur-sm">
                        <PlayCircle size={64} className="text-white" />
                    </div>
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* 5. TEST SERIES SECTION */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center">
        <motion.div {...fadeInUp}>
            <BarChart2 size={48} className="mx-auto text-[#34b3c1] mb-4" />
            <h2 className="text-4xl font-bold mb-6">The largest pan-India <span className="text-[#34b3c1]">Test Series</span></h2>
            <p className="max-w-2xl mx-auto text-gray-600 mb-10 text-lg">
                Taken by over 1 lakh participants across India, the Test Series gives you a fair idea of where you stand in the actual competition.
            </p>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-md mx-auto">
                <div className="text-sm text-gray-400">Your rank</div>
                <div className="text-5xl font-bold text-[#1a7a85] my-2">22<span className="text-xl">nd</span></div>
                <div className="text-blue-500 font-bold">99.8th Percentile</div>
            </div>
        </motion.div>
      </section>

      {/* 6. DEVICES SECTION */}
      <section className="py-20 bg-white text-center border-t border-gray-100">
         <motion.h2 {...fadeInUp} className="text-3xl font-bold mb-12 px-4">
            Marrow is available for use on all of your devices
         </motion.h2>
         <div className="flex flex-wrap justify-center gap-12 items-end">
            <motion.div whileHover={{ y: -10 }} className="w-24"><Smartphone size={80} className="mx-auto text-gray-400"/><p className="mt-2 text-sm uppercase">Mobile</p></motion.div>
            <motion.div whileHover={{ y: -10 }} className="w-40 border-b-4 border-gray-300 pb-2"><div className="h-24 w-full bg-gray-100 rounded-t-lg"></div><p className="mt-2 text-sm uppercase font-bold">Tablet</p></motion.div>
            <motion.div whileHover={{ y: -10 }} className="w-60 border-b-8 border-gray-800 pb-2"><div className="h-32 w-full bg-gray-100 rounded-t-lg"></div><p className="mt-2 text-sm uppercase">Laptop</p></motion.div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-100 py-10 text-center text-gray-500 text-sm">
        <p>© 2026 codON. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;