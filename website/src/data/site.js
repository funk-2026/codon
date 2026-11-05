// Every fact on the site lives in /src/data. Nothing is fetched at build or run time.

export const site = {
  name: 'Codon',
  legalName: 'CodON Health Private Limited',
  email: 'codonneetug@gmail.com',
  phoneDisplay: '+91 99871 34790',
  phoneTel: '+919987134790',
  whatsapp: 'https://wa.me/919987134790',
  hours: '8 am – 8 pm, every day',
  address: ['A-404, Nirman Palace,', 'Sher-e-Punjab, Andheri East,', 'Mumbai – 400093'],
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Nirman%20Palace%2C%20Sher-e-Punjab%2C%20Andheri%20East%2C%20Mumbai%20400093',
  // Store links. BOTH buttons are always shown on the site.
  // appStore: paste your App Store URL here, e.g. 'https://apps.apple.com/in/app/codon/id1234567890'
  // (the number is your Apple ID, found in App Store Connect -> App Information). While empty, the iOS button is inactive.
  playStore: 'https://play.google.com/store/apps/details?id=com.codon.learn',
  appStore: '',
  founder: 'Dr. Yogesh Desarda',
  year: 2026,
};

export const nav = [
  { to: '/marketing', label: 'The app' },
  { to: '/about', label: 'About' },
  { to: '/faqs', label: 'FAQs' },
  { to: '/contact', label: 'Contact' },
];

export const footerCols = [
  { title: 'Product', links: [{ to: '/marketing', label: 'The app' }, { to: '/faqs', label: 'FAQs' }] },
  { title: 'Company', links: [{ to: '/about', label: 'About us' }, { to: '/contact', label: 'Contact us' }] },
  { title: 'Legal', links: [{ to: '/privacy-policy', label: 'Privacy policy' }, { to: '/terms', label: 'Terms & conditions' }, { to: '/refund-policy', label: 'Refund policy' }] },
];

// People named in the existing About / FAQ copy. Add more here; no server or API involved.
export const faculty = [
  { name: 'Dr. Yogesh Desarda', role: 'General & Laparoscopic Surgeon · Founder', bio: 'Once an ordinary middle-class student with an extraordinary dream. Built Codon to give students the guidance he wished he had.', img: '' },
  { name: 'Dr. Akshat Chaturvedi', role: 'Mentor · Mind Mentor Mitra', bio: "Has been mentoring students for 4+ years, guiding many into India's top medical colleges.", img: '' },
];

export const marquee = ['Q Bank', 'Test Series', 'Custom tests', 'Tutor mode', 'Question palette', 'Confidence tracking', 'Time analysis', 'Mastery heat-map', 'Flashcards', 'Video lectures', 'Lecture PDFs', 'Timestamped notes', 'Brain Hacks', 'Offline answers', 'Daily streaks'];

// Sample test: three factual NEET Biology questions (c = index of the correct option)
export const quizQuestions = [
  { subject: 'Biology · Molecular Basis of Inheritance', q: 'Which enzyme unwinds the DNA double helix at the replication fork?', o: ['DNA ligase', 'RNA polymerase', 'Helicase', 'Exonuclease'], c: 2, e: 'Helicase breaks the hydrogen bonds between base pairs. Ligase seals nicks afterwards.' },
  { subject: 'Biology · Molecular Basis of Inheritance', q: 'Which of these is the start codon?', o: ['UAA', 'UGA', 'GGG', 'AUG'], c: 3, e: 'AUG codes for methionine and starts translation. UAA, UAG and UGA are stop codons.' },
  { subject: 'Biology · Human Physiology', q: 'At about 72 beats per minute, one cardiac cycle lasts approximately:', o: ['0.4 s', '0.8 s', '1.2 s', '1.6 s'], c: 1, e: '60 s ÷ 72 beats ≈ 0.8 s per cycle.' },
];

// Illustrative score trend (labelled "Sample data" on the page)
export const pulseData = { Biology: [58, 62, 61, 68, 72, 70, 76, 79, 83, 86], Chemistry: [49, 52, 58, 55, 60, 64, 63, 69, 71, 74], Physics: [41, 44, 43, 50, 48, 55, 58, 57, 63, 66] };

// Illustrative chapter mastery states for the heat-map tiles: g strong, a improving, r needs work, n not enough data
export const mastery = Array.from({ length: 32 }, (_, i) => ['g', 'a', 'a', 'r', 'g', 'n', 'a', 'g'][(i * 5 + (i >> 2)) % 8]);
