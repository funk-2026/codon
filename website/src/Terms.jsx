import React, { useEffect, useState } from "react";
import Header from "./Header";

const Terms = () => {
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.codonneetug.com/api/users/terms-conditions")
      .then((res) => res.text())
      .then((data) => {
        setTerms(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch T&C", err);
        setTerms("Unable to load Terms & Conditions.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <Header />

      {/* HERO */}
      <section className="relative pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-7xl font-black text-[#5bc5d4]">
          Terms & Conditions
        </h1>
        <p className="text-slate-600 mt-4">
          Please read the latest terms from our servers.
        </p>
      </section>

      {/* CONTENT */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-white border border-slate-100 rounded-[2rem] p-10 shadow-lg">
          {loading ? (
            <p className="text-center text-slate-500">Loading...</p>
          ) : (
            <div
              className="prose prose-lg text-slate-700"
              dangerouslySetInnerHTML={{ __html: terms }}
            />
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 pt-10 pb-6 text-center text-slate-400 text-sm">
        © 2026 codON Academy. All rights reserved.
      </footer>
    </div>
  );
};

export default Terms;
