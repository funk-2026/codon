// import React from 'react';
// import {
//   Phone, Mail, Facebook, Instagram, Youtube, Twitter,
//   BookOpen, Video, ShieldCheck, Monitor, Zap, Users,
//   GraduationCap, Database, Sliders, Globe, ChevronRight
// } from 'lucide-react';
// import Header from './Header';
// import logo from "./assets/logo.png";

// const CodonLogo = ({ className = "h-8" }) => (
//   <div className={`flex items-center ${className}`}>
//     <img src={logo} alt="Logo" className="h-full w-auto object-contain" />
//   </div>
// );

// const FeatureCard = ({ icon: Icon, title, description }) => (
//   <div className="group p-8 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
//     <div className="w-14 h-14 bg-[#f0f9fa] text-[#1a7a85] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#1a7a85] group-hover:text-white transition-colors duration-300">
//       <Icon size={28} />
//     </div>
//     <h3 className="text-xl font-bold text-slate-800 mb-3">{title}</h3>
//     <p className="text-slate-600 leading-relaxed text-sm">{description}</p>
//   </div>
// );


// const AboutUs = () => {



//   return (
//     <div className="min-h-screen bg-[#f8fafc] font-sans">
//       <Header />

//       {/* --- HERO SECTION --- */}
// <section className="relative pt-20 pb-16 overflow-hidden">
//   {/* Background Pattern */}
//   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(#5bc5d4_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>

//   {/* Main Centered Content Wrapper */}
//   <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
//     {/* Badge */}
//     <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full mb-8 shadow-sm">
//       <span className="relative flex h-3 w-3">
//         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5bc5d4] opacity-75"></span>
//         <span className="relative inline-flex rounded-full h-3 w-3 bg-[#1a7a85]"></span>
//       </span>
//       <span className="text-xs font-bold uppercase tracking-widest text-slate-500">About</span>
//     </div>

//     {/* Heading */}
//     <h1 className="text-5xl md:text-7xl font-black text-[#5bc5d4] mb-6 tracking-tight">
//       About US
//     </h1>

//     {/* Description */}
//     <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
//       codON is a premium education platform. We don't just teach facts; we build conceptual clarity for the ability of tomorrow.
//     </p>

//     {/* --- BUTTON CENTERED DIV START --- */}

//     {/* --- BUTTON CENTERED DIV END --- */}

//   </div>
// </section>

//       {/* --- FEATURES GRID --- */}
//       {/* --- ULTRA PREMIUM MANIFESTO SECTION --- */}
//       <section className="max-w-5xl mx-auto px-6 py-24 font-sans">
//         <div className="relative bg-white border border-slate-100 rounded-[3rem] p-10 md:p-20 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden">

//           {/* Subtle Decorative Background Gradient */}
//           <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#5bc5d4]/5 rounded-full blur-3xl"></div>
//           <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#1a7a85]/5 rounded-full blur-3xl"></div>

//           {/* Section Header - Clean & Minimal */}
//           <div className="mb-12 flex flex-col items-center md:items-start">
//             <div className="flex items-center gap-3 mb-4">
//               <div className="h-[2px] w-8 bg-[#1a7a85]"></div>
//               <h2 className="text-[#1a7a85] font-bold text-[11px] uppercase tracking-[0.5em]">
//                 The codON Methodology
//               </h2>
//             </div>
//             <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
//               Built for the <span className="text-[#5bc5d4]">Elite</span>.
//             </h3>
//           </div>

//           {/* Main Manifesto - Refined Typography */}
//           <div className="relative z-10">
//             <p className="text-slate-600 text-lg md:text-[1.2rem] leading-[2] font-light text-justify md:text-left">
//               At codON, we bridge the gap between academic knowledge and competitive success through
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Conceptual Mastery</span>,
//               structuring every MCQ and video to ensure you understand the 'Why' before the 'What.'
//               Recognizing that exams are won on screens, our
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Exam Simulation</span>
//               interfaces prepare you to tackle negative marking with surgical precision.
//               To guarantee 100% accuracy, every content piece is
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Double Peer-Reviewed</span>
//               by experts and updated with the latest textbooks, while our
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Spaced Repetition</span>
//               modules ensure long-term clinical retention.
//               You compete against the
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Largest Participant Base</span>
//               in India for real-time AIR analytics, utilizing a
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Dynamic QBank</span>
//               where 60% of questions are purely clinical.
//               Crafted <span className="text-slate-900 font-semibold italic">By the Best, For the Best</span>, codON works with the top 20% of rankers to keep content relevant, offering
//               <span className="text-slate-900 font-semibold border-b-2 border-[#5bc5d4]/30 pb-0.5 mx-1">Custom Modules</span>
//               that adapt to your unique learning pace.
//               Experience the full power of this ecosystem through our Official Presence at
//               <a href="https://www.codon.com" className="text-[#1a7a85] font-bold hover:text-[#5bc5d4] transition-all underline decoration-[#5bc5d4]/50 underline-offset-4 ml-1">
//                 codon.com
//               </a>.
//             </p>
//           </div>

//           {/* Verified Trust Strip */}
//           <div className="mt-20 pt-10 border-t border-slate-50 flex flex-wrap justify-between items-center gap-8">
//             {[
//               { icon: <ShieldCheck size={18} />, text: "Peer Reviewed" },
//               { icon: <Zap size={18} />, text: "Spaced Repetition" },
//               { icon: <Users size={18} />, text: "All-India Rank" },
//               { icon: <Monitor size={18} />, text: "CBT Interface" }
//             ].map((item, idx) => (
//               <div key={idx} className="flex items-center gap-2.5 text-slate-400 group hover:text-[#1a7a85] transition-colors cursor-default">
//                 <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-[#f0f9fa] transition-colors">
//                   {item.icon}
//                 </div>
//                 <span className="text-[10px] font-bold uppercase tracking-widest">{item.text}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* --- APP DOWNLOAD SECTION --- */}
// <section className="max-w-7xl mx-auto px-6 py-16">
//   <div className="bg-gradient-to-br from-[#1a7a85] to-[#2d4d50] rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">

//     {/* Left Content */}
//     <div className="md:w-1/2 text-center md:text-left">
//       <h2 className="text-3xl md:text-5xl font-bold mb-6">Learn on the go.</h2>
//       <p className="text-teal-50/80 text-lg mb-8">
//         Join 500,000+ students mastering medical concepts every day. Available on all your devices.
//       </p>
//       <div className="flex flex-wrap justify-center md:justify-start gap-4">
//         {/* App Store Button */}
//         <button className="bg-white text-black px-8 py-3 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-100 transition shadow-lg active:scale-95">
//           <div className="text-left leading-none text-[10px] uppercase text-gray-500">
//             Download on <br />
//             <span className="text-lg text-black">App Store</span>
//           </div>
//         </button>
//         {/* Play Store Button */}
//         <button className="bg-black text-white px-8 py-3 rounded-2xl font-bold border border-white/20 flex items-center gap-3 hover:bg-white/10 transition shadow-lg active:scale-95">
//           <div className="text-left leading-none text-[10px] uppercase text-gray-400">
//             Get it on <br />
//             <span className="text-lg text-white">Google Play</span>
//           </div>
//         </button>
//       </div>
//     </div>

//     {/* Right Content: Logo + Brand Name inside Circle */}
//     <div className="md:w-1/3 flex justify-center">
//       <div className="w-64 h-64 bg-white/10 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-md shadow-inner relative group transition-all duration-500 hover:bg-white/15">

//         {/* Logo and Name Container */}
//         <div className="flex flex-col items-center gap-2">
//           <CodonLogo className="h-20 md:h-24 transition-transform duration-500 group-hover:scale-110" />
//           <span className="text-3xl md:text-4xl font-black tracking-tighter text-white drop-shadow-lg">
//             Cod<span className="text-[#5bc5d4]">ON</span>
//           </span>
//           <div className="w-12 h-1 bg-[#5bc5d4] rounded-full mt-1 opacity-50 group-hover:w-20 transition-all duration-500"></div>
//         </div>

//       </div>
//     </div>

//   </div>
// </section>

//       {/* --- CONTACT & MAP --- */}
//       {/* <section className="max-w-7xl mx-auto px-6 py-20">
//         <div className="grid lg:grid-cols-2 gap-16 items-center">
//           <div className="space-y-10">
//             <div>
//               <h2 className="text-4xl font-bold text-slate-900 mb-4">Get in Touch</h2>
//               <p className="text-slate-500">Visit our headquarters or reach out to our support team.</p>
//             </div>

//             <div className="space-y-6">
//               <div className="flex gap-6 items-center">
//                 <div className="w-14 h-14 bg-white shadow-md rounded-2xl flex items-center justify-center text-[#1a7a85]"><Phone /></div>
//                 <div>
//                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Support Line</p>
//                   <p className="text-xl font-bold text-slate-800">+91 91111111111</p>
//                 </div>
//               </div>
//               <div className="flex gap-6 items-center">
//                 <div className="w-14 h-14 bg-white shadow-md rounded-2xl flex items-center justify-center text-[#1a7a85]"><Mail /></div>
//                 <div>
//                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Support</p>
//                   <p className="text-xl font-bold text-slate-800">support@codonmed.com</p>
//                 </div>
//               </div>
//             </div>

//             <div className="p-8 bg-slate-100 rounded-3xl">
//               <h4 className="font-bold text-slate-800 mb-2 text-lg">codON Health Private Limited</h4>
//               <p className="text-slate-500">393, Second Cross, Dollars Colony, JP Nagar 4th Phase, Bangalore, Pin 560078</p>
//             </div>
//           </div>

//           <div className="h-[450px] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
//             <iframe title="map" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3889.0645476313313!2d77.5936783758436!3d12.903597416382025!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae15167f2f111b%3A0xb36a18d53085287d!2sMarrow%20(Neuroglia%20Health%20Pvt%20Ltd)!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin" width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
//           </div>
//         </div>
//       </section> */}


//       {/* --- CONTACT & MAP SECTION UPDATED --- */}
// <section className="max-w-7xl mx-auto px-6 py-20">
//   <div className="grid lg:grid-cols-2 gap-16 items-center">
//     <div className="space-y-10">
//       <div>
//         <h2 className="text-4xl font-bold text-slate-900 mb-4">Get in Touch</h2>
//         <p className="text-slate-500">Visit our headquarters or reach out to our support team.</p>
//       </div>

//       <div className="space-y-6">
//         {/* Phone Clickable - Dial Pad khul jayega */}
//         <a 
//             href="https://wa.me/9987134790"
//   target="_blank"
//   rel="noopener noreferrer"
//           className="flex gap-6 items-center group cursor-pointer"
//         >
//           <div className="w-14 h-14 bg-white shadow-md rounded-2xl flex items-center justify-center text-[#1a7a85] group-hover:bg-[#1a7a85] group-hover:text-white transition-all duration-300">
//             <Phone size={24} />
//           </div>
//           <div>
//             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Support Line</p>
//             <p className="text-xl font-bold text-slate-800 group-hover:text-[#1a7a85] transition-colors">
//               +91 9987134790
//             </p>
//           </div>
//         </a>

//         {/* Email Clickable - Email Client khul jayega */}
//         <a 
//            href="https://mail.google.com/mail/?view=cm&fs=1&to=codonneetug@gmail.com"
//   target="_blank"
//   rel="noopener noreferrer"

//           className="flex gap-6 items-center group cursor-pointer"
//         >
//           <div className="w-14 h-14 bg-white shadow-md rounded-2xl flex items-center justify-center text-[#1a7a85] group-hover:bg-[#1a7a85] group-hover:text-white transition-all duration-300">
//             <Mail size={24} />
//           </div>
//           <div>
//             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Support</p>
//             <p className="text-xl font-bold text-slate-800 group-hover:text-[#1a7a85] transition-colors">
//               codonneetug@gmail.com
//             </p>
//           </div>
//         </a>

//       </div>

//       {/* Address Block */}
//       <div className="p-8 bg-slate-100 rounded-3xl">
//         <h4 className="font-bold text-slate-800 mb-2 text-lg">CodON Health Private Limited</h4>
//         <p className="text-slate-500">393, Second Cross, Dollars Colony, JP Nagar 4th Phase, Bangalore, Pin 560078</p>
//       </div>
//     </div>

//     {/* Map remains the same */}
//     <div className="h-[450px] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
//       <iframe title="map" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3889.0645476313313!2d77.5936783758436!3d12.903597416382025!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae15167f2f111b%3A0xb36a18d53085287d!2sMarrow%20(Neuroglia%20Health%20Pvt%20Ltd)!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin" width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
//     </div>
//   </div>
// </section>

//       {/* --- FOOTER --- */}
//       <footer className="bg-slate-950 pt-20 pb-10 text-center">
//         <div className="max-w-7xl mx-auto px-6">
//           <div className="mb-10 flex justify-center opacity-90 scale-125">
//             <CodonLogo />
//           </div>

//           <div className="flex justify-center gap-8 mb-12">
//             {[
//               { icon: Facebook, color: "#1877F2", link: "#" },
//               { icon: Instagram, color: "#E4405F", link: "#" },
//               { icon: Youtube, color: "#FF0000", link: "#" },
//               { icon: Twitter, color: "#ffffff", link: "#" }
//             ].map((social, i) => (
//               <a key={i} href={social.link} className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300 transform hover:-translate-y-1">
//                 <social.icon size={22} />
//               </a>
//             ))}
//           </div>

//           <div className="pt-10 border-t border-white/5">
//             <p className="text-slate-500 text-sm tracking-wide">
//               © 2026 codON Academy. Empowering Future Specialists.
//               <span className="block mt-2 font-mono text-[10px] opacity-30">BUILT FOR EXCELLENCE</span>
//             </p>
//           </div>
//         </div>
//       </footer>
//     </div>
//   );
// };

// export default AboutUs;




import React from 'react';
import {
  Phone, Mail, Facebook, Instagram, Youtube, Twitter,
  BookOpen, Heart, ShieldCheck, Monitor, Zap, Users,
  GraduationCap, Target, Lightbulb, MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import Header from './Header';
import logo from "./assets/logo.png";

const CodonLogo = ({ className = "h-8" }) => (
  <div className={`flex items-center ${className}`}>
    <img src={logo} alt="Logo" className="h-full w-auto object-contain" />
  </div>
);

const SectionHeading = ({ badge, title, subtitle }) => (
  <div className="mb-12 flex flex-col items-center md:items-start">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-[2px] w-8 bg-[#1a7a85]"></div>
      <h2 className="text-[#1a7a85] font-bold text-[11px] uppercase tracking-[0.5em]">{badge}</h2>
    </div>
    <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
      {title} <span className="text-[#5bc5d4]">{subtitle}</span>
    </h3>
  </div>
);

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <Header />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(#5bc5d4_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full mb-8 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1a7a85]">Our Story</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-[#5bc5d4] mb-6 tracking-tight">
            About <span className="text-[#1a7a85]">US</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed italic">
            "CodON was born from the belief that with the right mentorship, every sincere student can rise beyond limitations."
          </p>
        </div>
      </section>

      {/* --- FOUNDER'S STORY SECTION --- */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-white border border-slate-100 rounded-[3rem] p-10 md:p-16 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] relative overflow-hidden">
          <div className="grid lg:grid-cols-1 gap-12 relative z-10">
            <div>
              <SectionHeading badge="The Founder" title="Message from" subtitle="Dr. Yogesh Desarda" />
              <div className="space-y-6 text-slate-600 leading-[1.8] text-lg">
                <p>
                  Hi, I am <strong>Dr. Yogesh Desarda</strong>, a General and Laparoscopic Surgeon — and once an ordinary middle-class student with an extraordinary dream.
                </p>
                <p>
                  During my entrance exam preparation, I faced many challenges — from financial limitations to confusion about how to study and when to study. Like many students, I struggled with self-doubt and lack of guidance.
                </p>
                <div className="bg-[#f0f9fa] p-8 rounded-2xl border-l-4 border-[#5bc5d4] my-8">
                  <p className="text-slate-900 font-medium italic">
                    "Codon is not just an app — it is a mission to empower average and middle-class students to transform their potential into success and build a life of purpose."
                  </p>
                </div>
                <p>
                  It is built by doctors who have walked the same path. Codon is designed by surgeons and physicians based on their personal experiences during NEET UG and PG preparations.
                </p>
                <p>
                  To bridge the gap of real guidance, we help students connect directly with doctors from their dream branches. I want to connect with you not just as a teacher, but as someone who has been in your place.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- MMM SECTION (MENTAL WELL-BEING) --- */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-[#1a7a85] rounded-[3rem] p-10 md:p-16 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <Heart className="text-[#5bc5d4]" fill="#5bc5d4" />
              <h2 className="font-bold text-sm uppercase tracking-[0.3em]">Mental Well-Being</h2>
            </div>
            <h3 className="text-3xl md:text-5xl font-bold mb-8">MMM — Mind Mentor Mitra</h3>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-teal-50/90 text-lg leading-relaxed">
                <p>
                  Success is not only about academic preparation but also about <strong>mental strength</strong>. Through MMM, we provide emotional support and a safe space to share concerns and manage stress.
                </p>
                <p>
                  More than <strong>40+ doctors</strong> have joined MMM to support students' mental well-being, irrespective of which coaching platform they use.
                </p>
                <p className="text-sm bg-white/10 p-4 rounded-xl border border-white/10">
                  Special thanks to <strong>Dr. Akshat Chaturvedi</strong>, who has been mentoring students for 4+ years, guiding many into India's top medical colleges.
                </p>
              </div>
              <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 bg-white/10 rounded-2xl">
                    <div className="text-3xl font-bold text-[#5bc5d4]">40+</div>
                    <div className="text-[10px] uppercase tracking-widest mt-1 text-teal-100">Mentors</div>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl">
                    <div className="text-3xl font-bold text-[#5bc5d4]">100%</div>
                    <div className="text-[10px] uppercase tracking-widest mt-1 text-teal-100">Safe Space</div>
                  </div>
                  <div className="col-span-2 p-4 bg-[#5bc5d4]/20 rounded-2xl mt-2 border border-[#5bc5d4]/30">
                    <div className="text-lg font-bold">Emotional Resilience</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- MISSION & VISION --- */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Mission */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-[#f0f9fa] text-[#1a7a85] rounded-2xl flex items-center justify-center mb-6">
              <Target size={28} />
            </div>
            <h4 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h4>
            <p className="text-slate-600 leading-relaxed">
              To empower below-average, average, and aspiring students with the right mentorship, structured guidance, and emotional support to help them clear NEET UG and grow with confidence.
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-[#f0f9fa] text-[#1a7a85] rounded-2xl flex items-center justify-center mb-6">
              <Lightbulb size={28} />
            </div>
            <h4 className="text-2xl font-bold text-slate-900 mb-4">Our Vision</h4>
            <p className="text-slate-600 leading-relaxed">
              To create a supportive learning ecosystem where every student — regardless of background — feels capable and mentally strong, proving that anyone can transform potential into success.
            </p>
          </div>
        </div>
      </section>

      {/* --- CONTACT SECTION --- */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            <div>
              <SectionHeading badge="Connect" title="Get in" subtitle="Touch" />
              <p className="text-slate-500 -mt-8">Reach out to our support team for any queries.</p>
            </div>

            <div className="space-y-6">
              <a href="https://wa.me/9987134790" target="_blank" rel="noopener noreferrer" className="flex gap-6 items-center group cursor-pointer">
                <div className="w-14 h-14 bg-white shadow-md rounded-2xl flex items-center justify-center text-[#1a7a85] group-hover:bg-[#1a7a85] group-hover:text-white transition-all duration-300">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">WhatsApp Support</p>
                  <p className="text-xl font-bold text-slate-800 group-hover:text-[#1a7a85] transition-colors">+91 9987134790</p>
                </div>
              </a>

              <a href="mailto:codonneetug@gmail.com" className="flex gap-6 items-center group cursor-pointer">
                <div className="w-14 h-14 bg-white shadow-md rounded-2xl flex items-center justify-center text-[#1a7a85] group-hover:bg-[#1a7a85] group-hover:text-white transition-all duration-300">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Support</p>
                  <p className="text-xl font-bold text-slate-800 group-hover:text-[#1a7a85] transition-colors">codonneetug@gmail.com</p>
                </div>
              </a>
            </div>

            <div className="p-8 bg-slate-100 rounded-3xl">
              <h4 className="font-bold text-slate-800 mb-2 text-lg">CodON Health Private Limited</h4>
                    <p className="text-gray-600 text-sm mt-2">
         Codon by dr yogesh – A-404, Nirman palace,   <br />
          Sher-e-punjab, Andheri east, Mumbai – 400093
        </p>
            </div>
          </div>

<div className="h-[450px] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
  <iframe 
    title="map" 
    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.743279169435!2d72.84376337597142!3d19.11778195000492!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c9e19277717b%3A0x280e8e458e0a293b!2sAndheri%2C%20Mumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1710000000000!5m2!1sen!2sin" 
    width="100%" 
    height="100%" 
    style={{ border: 0 }} 
    allowFullScreen="" 
    loading="lazy"
  ></iframe>
</div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-950 pt-20 pb-10 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10 flex justify-center opacity-90 scale-125">
            <CodonLogo />
          </div>
          {/* <div className="flex justify-center gap-8 mb-12 text-slate-400">
             <Facebook className="hover:text-white cursor-pointer" />
             <Instagram className="hover:text-white cursor-pointer" />
             <Youtube className="hover:text-white cursor-pointer" />
             <Twitter className="hover:text-white cursor-pointer" />
          </div> */}
          <div className="flex justify-center gap-8 mb-12 text-slate-400">
            {/* Facebook */}
            <a
              href="https://www.facebook.com/yogesh.desarda.2025/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              <Facebook size={24} />
            </a>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/codon_dryogesh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              <Instagram size={24} />
            </a>

            {/* Youtube */}
            <a
              href="https://www.youtube.com/channel/UCWXjihdrzFZQPeN4Zp8UURA"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              <Youtube size={24} />
            </a>

            {/* Twitter */}
            {/* <a
              href="https://twitter.com/yourlink"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              <Twitter size={24} />
            </a> */}
          </div>
          <div className="pt-10 border-t border-white/5">
            <p className="text-slate-500 text-sm tracking-wide">
              © 2026 codon Academy. Built by Doctors, for Future Doctors.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutUs;