import React from "react";
import { motion } from "framer-motion";

import {
  PlayCircle,Phone, Mail , BookOpen, Play, Apple, BarChart2, Settings, Activity, ChevronLeft,
  ChevronRight, GraduationCap, Loader2, Sparkles, Facebook, Instagram, Youtube, Users, Dna, Database, ClipboardCheck, Video
} from 'lucide-react'; 
import { Link } from "react-router-dom";
import logo from './assets/logo.png'; // Aapne logo path check kar lein
import Header from "./Header";



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

const ContactPage = () => {
  return (
    <div className="min-h-screen bg-white">

      {/* NAVBAR */}

<Header />

      {/* HERO */}
      <section className="bg-gradient-to-b from-[#1a7a85] to-[#2a9ba8] py-28 text-center text-white">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-extrabold"
        >
          Contact Us
        </motion.h1>
      </section>

      {/* CONTACT CARD */}
      <section className="-mt-24 pb-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-10"
        >
          {/* <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-[#5bc5d4] rounded-full flex items-center justify-center text-white">
              <Phone />
            </div>
            <div>
              <p className="text-sm text-gray-500">Call (8am – 8pm, Everyday)</p>
              <p className="font-bold text-lg text-[#1a7a85]">+91 91111111111</p>
            </div>
          </div> */}
          <a
              href="https://wa.me/9987134790"
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-start gap-4 mb-8 group cursor-pointer"
>
  <div className="w-12 h-12 bg-[#5bc5d4] rounded-full flex items-center justify-center text-white group-hover:scale-110 transition">
    <Phone />
  </div>

  <div>
    <p className="text-sm text-gray-500">Call (8am – 8pm, Everyday)</p>
    <p className="font-bold text-lg text-[#1a7a85] group-hover:underline">
      +91 9987134790  
    </p>
  </div>
</a>


          {/* <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#5bc5d4] rounded-full flex items-center justify-center text-white">
              <Mail />
            </div>
            <div>
              <p className="text-sm text-gray-500">Email us</p>
              <p className="font-bold text-lg text-[#1a7a85]">
                support@codonacademy.com
              </p>
            </div>
          </div> */}
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=codonneetug@gmail.com"
  target="_blank"
  rel="noopener noreferrer"
            className="flex items-start gap-4 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-[#5bc5d4] rounded-full flex items-center justify-center text-white group-hover:scale-110 transition">
              <Mail />
            </div>

            <div>
              <p className="text-sm text-gray-500">Email us</p>
              <p className="font-bold text-lg text-[#1a7a85] group-hover:underline">
                codonneetug@gmail.com
              </p>
            </div>
          </a>

        </motion.div>
      </section>

      {/* ADDRESS */}
      <section className="text-center pb-16">
        <p className="font-semibold text-[#1a7a85]">CodON Academy Pvt. Ltd.</p>
        <p className="text-gray-600 text-sm mt-2">
         Codon by dr yogesh – A-404, Nirman palace,   <br />
          Sher-e-punjab, Andheri east, Mumbai – 400093
        </p>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 py-12 text-center text-white">
        <div className="flex justify-center mb-4 opacity-80">
          <CodonLogo />
        </div>
        <p className="text-gray-500 text-sm">© 2026 codon Academy</p>
        <div className="flex justify-center gap-6 mt-4 text-xs text-gray-400">
          <a href="/PrivacyPolicy" className="hover:text-white">Privacy Policy</a>
          <a href="/Terms" className="hover:text-white">Terms</a>
          <a href="/RefundPolicy" className="hover:text-white">RefundPolicy</a>
        </div>
      </footer>

    </div>
  );
};

export default ContactPage;
