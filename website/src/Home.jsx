import React, { useState, useEffect } from 'react'; // Corrected Import
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle, BookOpen, Play, Apple, BarChart2, Settings, Activity, ChevronLeft,
  ChevronRight, GraduationCap, Loader2, Sparkles, Facebook, Instagram, Youtube, Users, Dna, Database, ClipboardCheck, Video
} from 'lucide-react';
import { Link } from "react-router-dom";
import logo from "./assets/logo.png"
import text from "./assets/text.png"
import Header from './Header';

// --- PROFESSIONAL LOGO COMPONENT ---
const CodonLogo = ({ className = "h-8" }) => (
  <div className={`flex items-center ${className}`}>
    <img
      src={logo}
      alt="Logo"
      className="h-full w-auto object-contain" // h-full se ye parent ki height (h-8 ya h-16) le lega
    />
  </div>
);



const LandingPage = () => {
  const [faculty, setFaculty] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const itemsPerPage = 4;

  // Environment variable se base URL nikalna
  const BASE_URL = import.meta.env.VITE_BASE_URL || process.env.REACT_APP_BASE_URL;

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        setLoading(true);

        // BASE_URL yahan define karein
        const BASE_URL = import.meta.env.VITE_BASE_URL;

        // API Call: baseURL/api/faculty/list
        // Note: Base URL ke baad / check kar lein, double // na ho jaye
        const response = await fetch(`${BASE_URL}/api/faculty/list`);

        if (!response.ok) throw new Error('Network response was not ok');

        const resData = await response.json();

        // Agar aapka data "data" key ke andar hai toh resData.data use karein
        setFaculty(resData.data || resData);

      } catch (err) {
        console.error("Fetch Error:", err);
        setError("Data load nahi ho paya");
      } finally {
        setLoading(false);
      }
    };

    fetchFaculty();
  }, []);

  // Slider Logic (4 items at a time)
  const nextSlide = () => {
    if (currentIndex + itemsPerPage < faculty.length) {
      setCurrentIndex(prev => prev + itemsPerPage);
    } else {
      setCurrentIndex(0); // Pehle page par wapas jaane ke liye
    }
  };

  const prevSlide = () => {
    if (currentIndex - itemsPerPage >= 0) {
      setCurrentIndex(prev => prev - itemsPerPage);
    } else {
      // Last page par jaane ke liye
      const lastPageIndex = Math.floor((faculty.length - 1) / itemsPerPage) * itemsPerPage;
      setCurrentIndex(lastPageIndex);
    }
  };

  const visibleFaculty = faculty.slice(currentIndex, currentIndex + itemsPerPage);

  if (loading) return (
    <div className="h-64 flex items-center justify-center text-[#1a7a85]">
      <Loader2 className="animate-spin" size={40} />
    </div>
  );

  if (error) return <div className="text-center text-red-500 py-10 font-bold">Error: {error}</div>;
  if (faculty.length === 0) return null;

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">

      <Header />


      {/* 2. HERO SECTION */}



      <section className="relative min-h-[60vh] md:min-h-[90vh] flex items-start justify-center overflow-hidden bg-[#8db6bd]">
        {/* 1. DYNAMIC BACKGROUND LAYER - No Changes */}
        <div className="absolute inset-0 z-0">
          <motion.div
            animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-[#5bc5d4]/20 blur-[120px] rounded-full"
          />
          <motion.div
            animate={{ x: [0, -40, 0], y: [0, -60, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-0 -right-[5%] w-[40%] h-[40%] bg-[#5bc5d4]/30 blur-[100px] rounded-full"
          />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
        </div>

        {/* 2. FLOATING DECORATIVE ELEMENTS - No Changes */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute top-1/4 left-10 md:left-24 opacity-20 hidden md:block"
          >
            <Activity size={40} className="text-[#5bc5d4]" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 7, repeat: Infinity }}
            className="absolute bottom-1/4 right-10 md:right-24 opacity-20 hidden md:block"
          >
            <Sparkles size={40} className="text-[#5bc5d4]" />
          </motion.div>
        </div>

        {/* 3. MAIN CONTENT */}
        {/* Mobile pe pt-4 rakha hai aur desktop pe pt-20 */}
        <div className="relative z-10 max-w-5xl mx-auto text-center px-6 pt-4 md:pt-20">

          {/* Top Brand Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-1 md:mb-2"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, type: "spring" }}
              className="mb-3 md:mb-6 inline-block"
            >
              <div className="p-1 rounded-full bg-gradient-to-tr from-white/30 to-transparent">
                {/* Mobile pe p-3 rakha hai taaki circle thoda chhota dikhe */}
                <div className="p-3 md:p-6 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                  <img src={logo} className="h-10 md:h-16 object-contain" alt="Logo" />
                </div>
              </div>
            </motion.div>

            <p className="text-white/90 text-[12px] md:text-lg font-medium tracking-wide">
              Dr. Yogesh Desarda (General Surgeon) <span className="italic opacity-80">presents</span>
            </p>
          </motion.div>

          {/* Headline Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <h2 className="text-xl md:text-4xl font-bold text-white mb-2 md:mb-6 tracking-tight">
              NEET UG Learning App
            </h2>

            <p className="text-white/80 text-sm md:text-xl max-w-3xl mx-auto mb-4 md:mb-12 font-medium leading-relaxed">
              The Best & Simple solution for NEET-UG, <br className="hidden md:block" />
              Mentorship & mental well being of students.
            </p>
          </motion.div>
        </div>

        {/* 4. PREMIUM WAVE TRANSITION */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[40px] md:h-[80px] fill-white">
            <path d="M0,0 C300,80 900,10 1200,80 V120 H0 Z" opacity="0.4"></path>
            <path d="M0,40 C400,120 800,20 1200,100 V120 H0 Z"></path>
          </svg>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header with Navigation */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-black text-[#1a7a85] mb-4 tracking-tight">
                Meet Our MMM Faculty
              </h2>
              <div className="h-1.5 w-24 bg-[#5bc5d4] rounded-full mx-auto md:mx-0"></div>
            </div>

            {/* Slider Buttons - Sirf tab dikhenge jab items itemsPerPage se zyada honge */}
            {faculty.length > itemsPerPage && (
              <div className="flex gap-4">
                <button onClick={prevSlide} className="group p-4 rounded-2xl border-2 border-slate-100 hover:border-[#5bc5d4] hover:bg-[#5bc5d4]/10 transition-all duration-300">
                  <ChevronLeft size={24} className="group-hover:text-[#1a7a85] text-slate-400" />
                </button>
                <button onClick={nextSlide} className="group p-4 rounded-2xl border-2 border-slate-100 hover:border-[#5bc5d4] hover:bg-[#5bc5d4]/10 transition-all duration-300">
                  <ChevronRight size={24} className="group-hover:text-[#1a7a85] text-slate-400" />
                </button>
              </div>
            )}
          </div>

          {/* Faculty Grid Animation */}
          <div className="min-h-[450px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
              >
                {visibleFaculty.map((member, index) => (
                  <motion.div
                    key={member.id || index}
                    whileHover={{ y: -10 }}
                    className="bg-white rounded-[2.5rem] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-50 group transition-all duration-500 hover:shadow-[0_20px_60px_rgba(26,122,133,0.12)]"
                  >
                    {/* Faculty Image */}
                    <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden mb-6">
                      <img
                        // src={member.img || '/fallback-avatar.jpg'} // API se img field
                        src={`${import.meta.env.VITE_BASE_URL}/uploads/${member.image}`}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-xl text-[#1a7a85] shadow-sm">
                        <GraduationCap size={20} />
                      </div>
                    </div>

                    {/* Faculty Details */}
                    {/* <div className="px-2 pb-2">
                      <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-[#1a7a85] transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-[#5bc5d4] text-[13px] font-extrabold uppercase tracking-widest mb-3">
                        {member.degree}
                      </p>
                      <p className="text-slate-500 text-sm leading-relaxed ">
                        {member.description}
                      </p>
                    </div> */}
                    {/* Faculty Details */}
                    <div className="px-2 pb-2">
                      <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-[#1a7a85] transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-[#5bc5d4] text-[13px] font-extrabold uppercase tracking-widest mb-3">
                        {member.degree}
                      </p>

                      {/* Description with See More Logic */}
                      <div>
                        <p className={`text-slate-500 text-sm leading-relaxed ${expandedId === (member.id || member._id || index) ? '' : 'line-clamp-3'}`}>
                          {member.description}
                        </p>

                        {member.description && member.description.length > 100 && (
                          <button
                            onClick={() => setExpandedId(expandedId === (member.id || member._id || index) ? null : (member.id || member._id || index))}
                            className="text-[#1a7a85] text-xs font-bold mt-2 hover:underline flex items-center gap-1"
                          >
                            {expandedId === (member.id || member._id || index) ? 'See Less' : 'See More...'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center gap-2 mt-12">
            {Array.from({ length: Math.ceil(faculty.length / itemsPerPage) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i * itemsPerPage)}
                className={`h-1.5 transition-all duration-500 rounded-full ${Math.floor(currentIndex / itemsPerPage) === i ? "w-12 bg-[#1a7a85]" : "w-4 bg-slate-200"
                  }`}
              />
            ))}
          </div>

        </div>
      </section>

      {/* 5. WHY codeON SECTION */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">The <span className="text-[#1a7a85]">CODON</span> Advantage</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Moving beyond rote memorization to a conceptual ecosystem.</p>
          </motion.div>

          {/* <div className="grid md:grid-cols-3 gap-8">
            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#1a7a85] rounded-lg flex items-center justify-center text-white mb-6"><BookOpen size={28} /></div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Evidence-Based Learning</h3>
              <p className="text-gray-600 text-sm">Every MCQ and video is structured for concept-based learning.</p>
            </motion.div>

            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#34b3c1] rounded-lg flex items-center justify-center text-white mb-6"><Settings size={28} /></div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Active Solving</h3>
              <p className="text-gray-600 text-sm">Master the art of educated guessing and negative marking management.</p>
            </motion.div>

            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#5bc5d4] rounded-lg flex items-center justify-center text-white mb-6"><BarChart2 size={28} /></div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Simulation</h3>
              <p className="text-gray-600 text-sm">Experience real-time exam simulations with in-depth analytics.</p>
            </motion.div>
          </div> */}


          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 1. Mentox */}
            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#1a7a85] rounded-lg flex items-center justify-center text-white mb-6">
                <Users size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">MMM - Mind Mentor Mitra</h3>
              <p className="text-gray-600 text-sm">Personalized Mentorship to guide you through every step of your preparation.</p>
            </motion.div>

            {/* 2. CODON */}
            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#34b3c1] rounded-lg flex items-center justify-center text-white mb-6">
                <Dna size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">CODON</h3>
              <p className="text-gray-600 text-sm">Like Codons build DNA, here codons build the foundation of Physics, Chemistry, and Biology for NEET UG.</p>
            </motion.div>

            {/* 3. Q. Bank */}
            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#5bc5d4] rounded-lg flex items-center justify-center text-white mb-6">
                <Database size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Q. Bank</h3>
              <p className="text-gray-600 text-sm">A comprehensive Question Bank designed for deep conceptual practice and mastery.</p>
            </motion.div>

            {/* 4. Test Series */}
            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#1a7a85] rounded-lg flex items-center justify-center text-white mb-6">
                <ClipboardCheck size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Test Series</h3>
              <p className="text-gray-600 text-sm">Rigorous test series to simulate real exam environments and track your progress.</p>
            </motion.div>

            {/* 5. Recorded Video Classes */}
            <motion.div {...fadeInUp} className="p-8 rounded-2xl bg-slate-50 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-[#34b3c1] rounded-lg flex items-center justify-center text-white mb-6">
                <Video size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#1a7a85]">Video Classes</h3>
              <p className="text-gray-600 text-sm">High-quality recorded sessions for flexible learning and quick conceptual revision.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* VIDEO SECTION */}
      {/* <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeInUp}>
            <div className="text-[#34b3c1] mb-4"><PlayCircle size={48} /></div>
            <h2 className="text-4xl font-bold mb-6">Recorded <span className="text-[#34b3c1]">Video</span> Classes</h2>
            <p className="text-lg text-gray-600 leading-relaxed">Integrated conceptual content across all 19 subjects.</p>
          </motion.div>
          <motion.div {...fadeInUp} className="relative">
            <div className="bg-white p-4 rounded-xl shadow-xl">
              <img src={text} alt="Video" className="rounded-lg w-full" />
            </div>
          </motion.div>
        </div>
      </section> */}












      {/* 6. TESTIMONIALS SECTION */}
      {/* <section className="py-24 px-6 bg-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Success Stories from <span className="text-[#1a7a85]">Top Rankers</span></h2>
            <p className="text-gray-600">Join thousands of successful doctors who cleared NEET PG with codON.</p>
          </div>

          <div className="relative px-4">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className={`absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white p-3 rounded-full shadow-xl transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#1a7a85] hover:text-white text-gray-600'}`}
            >
              <ChevronLeft size={28} />
            </button>

            <div className="overflow-hidden">
              <motion.div
                className="flex gap-6"
                animate={{ x: `-${currentIndex * (100 / 3.05)}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {testimonialsData.map((item, index) => (
                  <div key={index} className="min-w-[calc(33.333%-16px)] bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-[350px]">
                    <p className="text-gray-600 leading-relaxed italic text-sm md:text-base">"{item.text}"</p>
                    <div className="flex items-center gap-4 mt-6">
                      <img src={item.img} alt={item.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#5bc5d4]" />
                      <div>
                        <h4 className="font-bold text-gray-900">{item.name}</h4>
                        <p className="text-[#1a7a85] font-bold text-xs">{item.rank}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            <button
              onClick={nextSlide}
              disabled={currentIndex >= testimonialsData.length - 3}
              className={`absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white p-3 rounded-full shadow-xl transition-all ${currentIndex >= testimonialsData.length - 3 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#1a7a85] hover:text-white text-gray-600'}`}
            >
              <ChevronRight size={28} />
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center">
            <div className="h-1.5 w-48 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#1a7a85] rounded-full"
                animate={{ width: `${((currentIndex + 3) / testimonialsData.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section> */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-[#1a7a85] to-[#2d4d50] rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">

          {/* Left Content */}
          <div className="md:w-1/2 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Learn on the go.</h2>
            <p className="text-teal-50/80 text-lg mb-8">
              Join 500,000+ students mastering medical concepts every day. Available on all your devices.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              {/* App Store Button */}
              <button className="bg-white text-black px-8 py-3 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-100 transition shadow-lg active:scale-95">
                <div className="text-left leading-none text-[10px] uppercase text-gray-500">
                  Download on <br />
                  <span className="text-lg text-black">App Store</span>
                </div>
              </button>
              {/* Play Store Button */}
              <a
                href="https://play.google.com/store/apps/details?id=com.codon.app"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black text-white px-8 py-3 rounded-2xl font-bold border border-white/20 flex items-center gap-3 hover:bg-white/10 transition shadow-lg active:scale-95 w-fit inline-flex"
              >
                <div className="text-left leading-none text-[10px] uppercase text-gray-400">
                  Get it on <br />
                  <span className="text-lg text-white">Google Play</span>
                </div>
              </a>
            </div>
          </div>

          {/* Right Content: Logo + Brand Name inside Circle */}
          <div className="md:w-1/3 flex justify-center">
            <div className="w-64 h-64 bg-white/10 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-md shadow-inner relative group transition-all duration-500 hover:bg-white/15">

              {/* Logo and Name Container */}
              <div className="flex flex-col items-center gap-2">
                <CodonLogo className="h-20 md:h-24 transition-transform duration-500 group-hover:scale-110" />
                <span className="text-3xl md:text-4xl font-black tracking-tighter text-white drop-shadow-lg">
                  {/* Cod<span className="text-[#5bc5d4]">ON</span> */}
                </span>
                <div className="w-12 h-1 bg-[#5bc5d4] rounded-full mt-1 opacity-50 group-hover:w-20 transition-all duration-500"></div>
              </div>

            </div>
          </div>

        </div>
      </section>



      {/* FOOTER */}
      {/* <footer className="bg-gray-900 py-12 text-center text-white">
        <div className="mb-6 flex justify-center opacity-80"><CodonLogo /></div>
        <p className="text-gray-500 text-sm">© 2026 codON Academy. Empowering Future Specialists.</p>
      </footer> */}

      <footer className="bg-gray-900 py-12 text-center text-white">
        {/* Logo Section */}
        <div className="mb-6 flex justify-center opacity-80">
          <CodonLogo />
        </div>

        {/* Social Media Icons Section */}
        <div className="flex justify-center gap-6 mb-8">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#1877F2] transition-all duration-300 transform hover:scale-110"
          >
            <Facebook size={24} />
          </a>

          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#E4405F] transition-all duration-300 transform hover:scale-110"
          >
            <Instagram size={24} />
          </a>

          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#FF0000] transition-all duration-300 transform hover:scale-110"
          >
            <Youtube size={24} />
          </a>


        </div>
        <div className="flex justify-center gap-8 mb-8 text-sm font-medium">
          <a
            href="/Terms"
            className="text-gray-400 hover:text-[#5bc5d4] transition-colors duration-300"
          >
            Terms & Conditions
          </a>
          <a
            href="/PrivacyPolicy"
            className="text-gray-400 hover:text-[#5bc5d4] transition-colors duration-300"
          >
            Privacy Policy
          </a>
          <a
            href="/Faqs"
            className="text-gray-400 hover:text-[#5bc5d4] transition-colors duration-300"
          >
            Faq's
          </a>
        </div>
        

        {/* Copyright Section */}
        {/* <p className="text-gray-500 text-sm border-t border-gray-800 pt-8 max-w-xs mx-auto">
          © 2026 CODON Classes Accademy. Empowering Future Specialists.
        </p> */}
        <div className="border-t border-gray-800 pt-8">
    <p className="text-gray-500 text-sm max-w-xs mx-auto mb-2">
      © 2026 CODON Classes Accademy. Empowering Future Specialists.
    </p>
    
    {/* Premium Developed By Credit */}
    <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em] font-medium">
      Developed by{" "}
      <a 
        href="https://dbvertex.com" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="hover:text-[#5bc5d4] transition-all duration-300 border-b border-transparent hover:border-[#5bc5d4] pb-0.5"
      >
        dbvertex.com
      </a>
    </p>
  </div>
      </footer>

      {/* --- FLOATING WHATSAPP BUTTON --- */}
      {/* <motion.a
        href="https://wa.me/9987134790?text=Hi%20CODON,%20I%20have%20a%20query%20regarding%20NEET%20PG%20preparation."
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-[0_10px_30px_rgba(37,211,102,0.4)] flex items-center justify-center group"
      >
        
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>

      
        <span className="absolute right-full mr-4 bg-white text-gray-800 px-3 py-1 rounded-lg text-sm font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-gray-100">
          Chat with Experts
        </span>
      </motion.a> */}

      <motion.a
        // href="https://wa.me/9987134790?text=Hi%20CODON,%20I%20have%20a%20query%20regarding%20NEET%20PG%20preparation."
        href="https://wa.me/9987134790?text=Hi%20Dr%20Yogesh%20%F0%9F%91%8B%0AI%20am%20a%20NEET%20UG%20aspirant%20and%20an%20ambitious%20future%20doctor.%20I%20would%20like%20to%20know%20more%20about%20Mind%20Mentor%20Mitra%20(MMM)%2C%20the%20mentors%2C%20and%20CODON%2C%20and%20how%20they%20can%20help%20make%20my%20NEET%20UG%20preparation%20more%20simple%2C%20structured%2C%20and%20systematic%20so%20that%20I%20can%20achieve%20an%20MBBS%20seat%20in%20this%20exam.%0ALooking%20forward%20to%20your%20guidance.%20Thank%20you%20%F0%9F%99%82"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        // Mobile par p-5 (zyada padding) aur bottom-6 (thoda niche), Desktop par p-4 aur bottom-8
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] bg-[#25D366] text-white p-5 md:p-4 rounded-full shadow-[0_10px_30px_rgba(37,211,102,0.4)] flex items-center justify-center group"
      >
        {/* WhatsApp SVG Icon */}
        <svg
          viewBox="0 0 24 24"
          // Mobile par w-10 h-10 (40px), Desktop par w-8 h-8 (32px)
          className="w-10 h-10 md:w-8 md:h-8"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>

        {/* Tooltip Label (Desktop par hi dikhega, mobile par hidden rakhna hi sahi hai) */}
        <span className="hidden md:block absolute right-full mr-4 bg-white text-gray-800 px-3 py-1 rounded-lg text-sm font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-gray-100">
          Chat with Experts
        </span>
      </motion.a>
    </div>
  );
};

export default LandingPage;