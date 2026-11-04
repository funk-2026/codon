// import React, { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom';
// import logo from './assets/logo.png';
// import {
//   PlayCircle, BookOpen, Menu, X, Play, Apple, BarChart2, Settings, Activity, ChevronLeft,
//   ChevronRight, GraduationCap, Loader2, Sparkles, Facebook, Instagram, Youtube, Users, Dna, Database, ClipboardCheck, Video
// } from 'lucide-react'; // Aapne logo path check kar lein

// const CodonLogo = ({ className = "h-8" }) => (
//   <div className={`flex items-center ${className}`}>
//     <img
//       src={logo}
//       alt="Logo"
//       className="h-full w-auto object-contain"
//     />
//   </div>
// );

// const StoreButton = ({ icon, sub, title, mobile }) => (
//   <a
//     href="#"
//     className={`flex items-center gap-2.5 px-3 py-1.5 border border-white/20 rounded-xl bg-white/5 hover:bg-[#5bc5d4]/10 hover:border-[#5bc5d4] transition-all group ${mobile ? 'w-full justify-center py-3' : ''}`}
//   >
//     {icon}
//     <div className="flex flex-col items-start leading-tight">
//       <span className="text-[7px] font-medium text-white/60 uppercase tracking-tighter">{sub}</span>
//       <span className={`${mobile ? 'text-sm' : 'text-[13px]'} font-bold text-white group-hover:text-[#5bc5d4]`}>{title}</span>
//     </div>
//   </a>
// );

// const Header = () => {
//   const [isOpen, setIsOpen] = useState(false);

//   return (
//     <nav className="bg-black/90 backdrop-blur-md text-white sticky top-0 z-50 shadow-lg w-full border-b border-white/5">
//       <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between relative">

//         {/* 1. Left Side: Logo */}
//         <div className="flex items-center z-50">
//           <Link to="/" className="flex flex-col items-center cursor-pointer group">
//             <CodonLogo className="h-8 w-auto md:h-9" />
//             <span className="text-[10px] md:text-xs font-black tracking-widest uppercase mt-1">
//               Cod<span className="text-[#5bc5d4]">ON</span>
//             </span>
//           </Link>
//         </div>

//         {/* 2. Desktop Navigation Links (Middle) */}
//         <div className="hidden md:flex absolute left-1/2 -translate-x-[calc(50%+105px)]">

//           <div className="flex flex-nowrap whitespace-nowrap gap-6 lg:gap-8 text-[12px] font-bold tracking-wider uppercase">
//             <a href="#" className="hover:text-[#5bc5d4] transition-colors">NEET UG</a>
//             <a href="mentors" className="hover:text-[#5bc5d4] transition-colors">MENTORS</a>
//             <Link to="/plans" className="hover:text-[#5bc5d4] transition-colors">PLANS</Link>
//             <Link to="#" className="hover:text-[#5bc5d4] transition-colors">FEATURES</Link>
//             <Link to="/contact" className="hover:text-[#5bc5d4] transition-colors">CONTACT</Link>
//             <a href="/AboutUs" className="hover:text-[#5bc5d4] transition-colors">ABOUT US</a>
//             <a href="/Terms" className="hover:text-[#5bc5d4] transition-colors">Term & Conditions</a>
//             <a href="/PrivacyPolicy" className="hover:text-[#5bc5d4] transition-colors">Privacy Policy</a>
//           </div>
//         </div>


//         {/* 3. Right Side: Store Buttons (Desktop) & Hamburger (Mobile) */}
//         <div className="flex items-center gap-3 z-50">
//           {/* Desktop Store Buttons */}
//           <div className="hidden lg:flex items-center gap-3">
//             <StoreButton icon={<Play size={18} className="fill-[#5bc5d4] text-[#5bc5d4]" />} sub="Get it on" title="Google Play" />
//             <StoreButton icon={<Apple size={20} />} sub="Download on the" title="App Store" />
//           </div>

//           {/* Mobile Menu Toggle Button */}
//           <button
//             className="md:hidden p-2 text-white hover:text-[#5bc5d4]"
//             onClick={() => setIsOpen(!isOpen)}
//           >
//             {isOpen ? <X size={28} /> : <Menu size={28} />}
//           </button>
//         </div>

//         {/* 4. Mobile Menu Overlay */}
//         {/* 4. Mobile Menu Overlay */}
//         {isOpen && (
//           <div className="md:hidden fixed inset-x-0 top-[74px] bottom-0 h-[calc(100vh-74px)] bg-black z-40 flex flex-col overflow-y-auto">
//             {/* Links Container */}
//             <div className="flex flex-col p-8 gap-1">
//               {[
//                 { name: "NEET UG", path: "#" },
//                 { name: "MENTORS", path: "#" },
//                 { name: "PLANS", path: "#" },
//                 { name: "FEATURES", path: "#" },
//                 { name: "CONTACT", path: "/contact" },
//                 { name: "ABOUT US", path: "/AboutUs" },
//               ].map((link, i) => (
//                 <Link
//                   key={i}
//                   to={link.path}
//                   onClick={() => setIsOpen(false)}
//                   className="text-white text-xl font-bold tracking-widest uppercase py-4 border-b border-white/5 hover:text-[#5bc5d4] transition-colors"
//                 >
//                   {link.name}
//                 </Link>
//               ))}

//               {/* Mobile Store Buttons (Menu ke niche) */}
//               <div className="flex flex-col gap-4 mt-8 pb-10">
//                 <StoreButton
//                   mobile
//                   icon={<Play size={20} className="fill-[#5bc5d4] text-[#5bc5d4]" />}
//                   sub="Get it on"
//                   title="Google Play"
//                 />
//                 <StoreButton
//                   mobile
//                   icon={<Apple size={22} />}
//                   sub="Download on the"
//                   title="App Store"
//                 />
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </nav>


//   );


// };

// export default Header;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from './assets/logo.png';
import {
  PlayCircle, BookOpen, Menu, X, Play, Apple, BarChart2, Settings, Activity, ChevronLeft,
  ChevronRight, GraduationCap, Loader2, Sparkles, Facebook, Instagram, Youtube, Users, Dna, Database, ClipboardCheck, Video
} from 'lucide-react';

const CodonLogo = ({ className = "h-8" }) => (
  <div className={`flex items-center ${className}`}>
    <img
      src={logo}
      alt="Logo"
      className="h-full w-auto object-contain"
    />
  </div>
);

// Yahan 'link' prop add kiya gaya hai
const StoreButton = ({ icon, sub, title, mobile, link }) => (
  <a
    href={link || "https://play.google.com/store/apps/details?id=com.codon.app"}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center gap-2.5 px-3 py-1.5 border border-white/20 rounded-xl bg-white/5 hover:bg-[#5bc5d4]/10 hover:border-[#5bc5d4] transition-all group ${mobile ? 'w-full justify-center py-3' : ''}`}
  >
    {icon}
    <div className="flex flex-col items-start leading-tight">
      <span className="text-[7px] font-medium text-white/60 uppercase tracking-tighter">{sub}</span>
      <span className={`${mobile ? 'text-sm' : 'text-[13px]'} font-bold text-white group-hover:text-[#5bc5d4]`}>{title}</span>
    </div>
  </a>
);

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-black/90 backdrop-blur-md text-white sticky top-0 z-50 shadow-lg w-full border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between relative">

        {/* 1. Left Side: Logo */}
        <div className="flex items-center z-50">
          <Link to="/" className="flex flex-col items-center cursor-pointer group">
            <CodonLogo className="h-8 w-auto md:h-9" />
            <span className="text-[10px] md:text-xs font-black tracking-widest uppercase mt-1">
              Cod<span className="text-[#5bc5d4]">ON</span>
            </span>
          </Link>
        </div>

        {/* 2. Desktop Navigation Links (Middle) */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-[calc(50%+105px)]">
          <div className="flex flex-nowrap whitespace-nowrap gap-6 lg:gap-8 text-[12px] font-bold tracking-wider uppercase">
            <a href="#" className="hover:text-[#5bc5d4] transition-colors">NEET UG</a>
            {/* <a href="#mentors" className="hover:text-[#5bc5d4] transition-colors">MENTORS</a> */}
            <Link to="/plans" className="hover:text-[#5bc5d4] transition-colors">PLANS</Link>
            {/* <Link to="#FEATURES" className="hover:text-[#5bc5d4] transition-colors">FEATURES</Link> */}
            <Link to="/contact" className="hover:text-[#5bc5d4] transition-colors">CONTACT</Link>
            <a href="/AboutUs" className="hover:text-[#5bc5d4] transition-colors">ABOUT US</a>
            {/* <a href="/Terms" className="hover:text-[#5bc5d4] transition-colors">Term & Conditions</a>
            <a href="/PrivacyPolicy" className="hover:text-[#5bc5d4] transition-colors">Privacy Policy</a> */}
             {/* <a href="/Faqs" className="hover:text-[#5bc5d4] transition-colors">Faq's</a> */}
          </div>
        </div>


        {/* 3. Right Side: Store Buttons (Desktop) */}
        <div className="flex items-center gap-3 z-50">
          <div className="hidden lg:flex items-center gap-3">
            <StoreButton 
              link="https://play.google.com/store/apps/details?id=com.codon.app"
              icon={<Play size={18} className="fill-[#5bc5d4] text-[#5bc5d4]" />} 
              sub="Get it on" 
              title="Google Play" 
            />
            <StoreButton 
              link="#" // Apple Store link yahan dal sakte hain
              icon={<Apple size={20} />} 
              sub="Download on the" 
              title="App Store" 
            />
          </div>

          <button
            className="md:hidden p-2 text-white hover:text-[#5bc5d4]"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* 4. Mobile Menu Overlay */}
        {isOpen && (
          <div className="md:hidden fixed inset-x-0 top-[74px] bottom-0 h-[calc(100vh-74px)] bg-black z-40 flex flex-col overflow-y-auto">
            <div className="flex flex-col p-8 gap-1">
              {[
                { name: "NEET UG", path: "#" },
                { name: "MENTORS", path: "#" },
                { name: "PLANS", path: "#" },
                { name: "FEATURES", path: "#" },
                { name: "CONTACT", path: "/contact" },
                { name: "ABOUT US", path: "/AboutUs" },
              ].map((link, i) => (
                <Link
                  key={i}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className="text-white text-xl font-bold tracking-widest uppercase py-4 border-b border-white/5 hover:text-[#5bc5d4] transition-colors"
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile Store Buttons */}
              <div className="flex flex-col gap-4 mt-8 pb-10">
                <StoreButton
                  mobile
                  link="https://play.google.com/store/apps/details?id=com.codon.app"
                  icon={<Play size={20} className="fill-[#5bc5d4] text-[#5bc5d4]" />}
                  sub="Get it on"
                  title="Google Play"
                />
                <StoreButton
                  mobile
                  link="#"
                  icon={<Apple size={22} />}
                  sub="Download on the"
                  title="App Store"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Header;