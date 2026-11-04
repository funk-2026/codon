import React from "react";
import Header from "./Header";

const plans = [
  {
    title: "🟢 7-Day Guided Starter Access",
    price: "₹49",
    perDay: "Approx. ₹7/day",
    desc: "Perfect for exploring the platform and getting started with guided learning.",
  },
  {
    title: "🔵 Starter Plan — 1 Month",
    price: "₹199",
    perDay: "Approx. ₹6.6/day",
    desc: "Ideal for short-term preparation and trying out the full learning experience.",
  },
  {
    title: "⭐ Most Popular — 3 Months",
    price: "₹499",
    perDay: "Approx. ₹5.5/day",
    desc: "Great for building consistency and strengthening core concepts.",
    highlight: true,
  },
  {
    title: "🏆 6 Months + 3 Months Extra",
    price: "₹999",
    perDay: "Approx. ₹3.9/day",
    desc: "Designed for serious preparation with extended access for better continuity.",
  },
  {
    title: "💎 Best Value — 12 Months",
    price: "₹1799",
    perDay: "Approx. ₹4.9/day",
    desc: "Comprehensive long-term access for complete syllabus coverage and revision.",
  },
  {
    title: "🎯 Serious Aspirant — 24 Months",
    price: "₹2999",
    perDay: "Approx. ₹4.1/day",
    desc: "Maximum flexibility and long-term preparation support for dedicated aspirants.",
  },
];

const Plans = () => {
  return (
    <div className="min-h-screen bg-black text-white">

      <Header />

      {/* HERO */}
      <section className="pt-28 pb-16 text-center px-6">
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-wider">
          Subscription <span className="text-[#5bc5d4]">Plans</span>
        </h1>
        <p className="text-white/60 mt-6 max-w-3xl mx-auto text-lg">
          Choose a plan that fits your preparation journey. All plans provide
          full access to core learning features to help you stay consistent and improve performance.
        </p>
      </section>

      {/* PLANS GRID */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white/5 backdrop-blur-md p-8 rounded-2xl border transition-all duration-300 hover:scale-105
              ${
                plan.highlight
                  ? "border-[#5bc5d4] shadow-lg shadow-[#5bc5d4]/20 scale-105"
                  : "border-white/10"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#5bc5d4] text-black text-xs px-4 py-1 rounded-full font-bold uppercase">
                  Most Popular
                </div>
              )}

              <h2 className="text-xl font-bold mb-4">{plan.title}</h2>

              <p className="text-3xl font-black text-[#5bc5d4] mb-2">
                {plan.price}
              </p>

              <p className="text-white/60 mb-4">{plan.perDay}</p>

              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                {plan.desc}
              </p>

              <button className="w-full bg-[#5bc5d4] text-black font-bold py-3 rounded-xl hover:bg-white transition-all">
                Choose Plan
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-white/10 py-6 text-center text-white/50 text-sm">
        © 2026 codON Academy. All rights reserved.
      </footer>

    </div>
  );
};

export default Plans;
