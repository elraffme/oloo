import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 
  | 'en' | 'sw' | 'yo' | 'zu' | 'am' | 'ha' | 'ig' | 'so' | 'om' 
  | 'sn' | 'wo' | 'xh' | 'ti' | 'af' | 'ak' | 'rw' | 'ln' | 'ff' 
  | 'bem' | 'tn' | 'tw';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

const translations: Record<Language, Record<string, string>> = {
  en: {
    tagline: "Cultured in Connection",
    createAccount: "Create account",
    alreadyMember: "Already a member? Log in",
    culture: "Culture",
    discover: "Discover",
    collective: "Collective",
    languages: "Languages",
    signIn: "Sign In",
    joinNow: "Join Now",
    whyCultureDifferent: "Why \"The Culture\" Is Different",
    globalCulture: "Global Culture",
    globalCultureDesc: "This is a culture inspired space. Be it friendship culture, dating culture, relationship culture and even beyond. Connect with people from all corners of the globe—find your tribe.",
    virtualDates: "Virtual Dates",
    virtualDatesDesc: "Explore new ways to connect, like cooking a dish together over video call, sharing your favorite poetry, or showing each other local art galleries.",
    sharedEvents: "Shared Events",
    sharedEventsDesc: "Attend exclusive online and offline cultural events: film festivals, music festivals, poetry slams, or even regional festivals. Meet your match while immersing yourself in art, culture, and history.",
    curatedPlaylists: "Curated Playlists",
    curatedPlaylistsDesc: "Each week, enjoy curated playlists designed around different cultural genres. Find someone to vibe with over an Afrobeat playlist or discover classical Eastern music together.",
    intellectualDialogue: "Intellectual & Creative Dialogue",
    intellectualDialogueDesc: "Engage in meaningful conversations, whether it's about philosophy, literature, or film. Our platform's focus is on building deeper emotional and intellectual connections.",
    discoverMeaningful: "Discover Meaningful Connections",
    culturalQuiz: "Cultural Compatibility Quiz",
    culturalQuizDesc: "Find out which cultural experiences resonate with your soul through a simple yet thoughtful quiz that reflects your values, interests, and artistic tastes.",
    personalizedMatch: "Personalized Matchmaking",
    personalizedMatchDesc: "Using your cultural preferences, passions, and personality traits, we match you with others who share similar lifestyles, traditions, and ideology.",
    shareConnect: "Share and Connect",
    shareConnectDesc: "Participate in engaging conversations, exchange creative works, explore unique cultural events, or enjoy a virtual dinner date with someone who speaks your cultural language.",
    memberStories: "Our Members' Stories",
    getInspired: "Get Inspired, Explore Together",
    readyExperience: "Ready to Experience a Connection Like No Other?",
    embraceCulture: "Embrace culture, art, and soul—find someone who truly gets you.",
    createProfileNow: "Create Your Profile Now",
  },
  sw: {
    tagline: "Tunavyounganishwa na Utamaduni",
    createAccount: "Unda akaunti",
    alreadyMember: "Tayari ni mwanachama? Ingia",
    culture: "Utamaduni",
    discover: "Gundua",
    collective: "Pamoja",
    languages: "Lugha",
    signIn: "Ingia",
    joinNow: "Jiunge Sasa",
    whyCultureDifferent: "Kwa Nini \"Utamaduni\" ni Tofauti",
    globalCulture: "Utamaduni wa Kimataifa",
    virtualDates: "Miadi ya Mtandaoni",
    sharedEvents: "Matukio ya Pamoja",
    curatedPlaylists: "Orodha za Muziki",
    intellectualDialogue: "Mazungumzo ya Kiakili",
    discoverMeaningful: "Gundua Uhusiano Wenye Maana",
    readyExperience: "Tayari Kupata Uzoefu wa Kipekee?",
    createProfileNow: "Unda Wasifu Wako Sasa",
  },
  yo: {
    tagline: "A fi Àṣà Ṣe Ìsopọ̀",
    createAccount: "Ṣẹda àkáùntì",
    alreadyMember: "Ṣe o ti jẹ́ ọmọ ẹgbẹ́? Wọlé",
    culture: "Àṣà",
    discover: "Ṣàwárí",
    collective: "Àjọpọ̀",
    languages: "Àwọn èdè",
    signIn: "Wọlé",
    joinNow: "Darapọ̀ Nísinsin yìí",
    whyCultureDifferent: "Kini Idi Ti \"Àṣà\" Fi Yàtọ̀",
    globalCulture: "Àṣà Àgbáyé",
    readyExperience: "Ṣe o ti ṣetán láti Ní Ìrírí Àìlẹ́gbẹ́?",
    createProfileNow: "Ṣẹda Profaili Rẹ Nísinsin yìí",
  },
  zu: {
    tagline: "Sihlanganiswa Ngamasiko",
    createAccount: "Dala i-akhawunti",
    alreadyMember: "Usuyilungu? Ngena ngemvume",
    culture: "Amasiko",
    discover: "Thola",
    collective: "Sibumbene",
    languages: "Izilimi",
    signIn: "Ngena",
    joinNow: "Joyina Manje",
    whyCultureDifferent: "Kungani \"Amasiko\" Ehlukile",
    readyExperience: "Ukulungele Ukuthola Ukuxhumana Okungafani Nakho?",
    createProfileNow: "Dala Iphrofayela Yakho Manje",
  },
  am: {
    tagline: "በባህል የተገናኘን",
    createAccount: "መለያ ፍጠር",
    alreadyMember: "ቀድሞውኑ አባል ነዎት? ግባ",
    culture: "ባህል",
    discover: "አግኝ",
    collective: "አንድነት",
    languages: "ቋንቋዎች",
    signIn: "ግባ",
    joinNow: "አሁን ተቀላቀል",
    readyExperience: "ልዩ ግንኙነት ለማግኘት ዝግጁ ነዎት?",
    createProfileNow: "መገለጫዎን አሁን ይፍጠሩ",
  },
  ha: {
    tagline: "An Haɗa Mu Ta Al'ada",
    createAccount: "Ƙirƙiri asusun",
    alreadyMember: "Kai memba ne? Shiga",
    culture: "Al'ada",
    discover: "Gano",
    collective: "Tare",
    languages: "Harsuna",
    signIn: "Shiga",
    joinNow: "Shiga Yanzu",
    readyExperience: "Shin Kun Shirya Don Samun Haɗin Gwiwa Na Musamman?",
    createProfileNow: "Ƙirƙiri Bayanan Ka Yanzu",
  },
  ig: {
    tagline: "Ejikọtara N'omenala",
    createAccount: "Mepụta akaụntụ",
    alreadyMember: "Ị bụlarị onye òtù? Banye",
    culture: "Omenala",
    discover: "Chọpụta",
    collective: "Ọnụ",
    languages: "Asụsụ",
    signIn: "Banye",
    joinNow: "Sonye Ugbu a",
    readyExperience: "Ị Dị Njikere Ịnweta Njikọ Pụrụ Iche?",
    createProfileNow: "Mepụta Profaịlụ Gị Ugbu a",
  },
  // Adding other languages with at least key translations
  so: { tagline: "Dhaqan ku Xidhan", createAccount: "Samee koonto", culture: "Dhaqan", languages: "Luqadaha" },
  om: { tagline: "Aadaa Waliin Walitti Dhufeenya", createAccount: "Akkaawuntii Uumi", culture: "Aadaa", languages: "Afaanota" },
  sn: { tagline: "Takabatana Netsika", createAccount: "Gadzira account", culture: "Tsika", languages: "Mitauro" },
  wo: { tagline: "Yoon Na Ci Aadaa", createAccount: "Sos konte", culture: "Aadaa", languages: "Làkk" },
  xh: { tagline: "Sidibene Ngenkcubeko", createAccount: "Yenza i-akhawunti", culture: "Inkcubeko", languages: "Iilwimi" },
  ti: { tagline: "ብባህሊ ተራኺብና", createAccount: "ኣካውንት ፍጠር", culture: "ባህሊ", languages: "ቋንቋታት" },
  af: { tagline: "Kultuurlik Verbind", createAccount: "Skep rekening", culture: "Kultuur", languages: "Tale" },
  ak: { tagline: "Amanneɛ Mu Nkitahodie", createAccount: "Yɛ akontaabu", culture: "Amanneɛ", languages: "Kasa" },
  rw: { tagline: "Duhujwe n'Umuco", createAccount: "Kora konti", culture: "Umuco", languages: "Indimi" },
  ln: { tagline: "Tokutani na Mimeseno", createAccount: "Kela kɔnti", culture: "Mimeseno", languages: "Nkótá" },
  ff: { tagline: "Jokkondiranɗe e Golle", createAccount: "Sos konte", culture: "Golle", languages: "Ɗemɗe" },
  bem: { tagline: "Twabungana mu Micila", createAccount: "Panga akawunti", culture: "Micila", languages: "Imilaka" },
  tn: { tagline: "Re Kopane ka Setso", createAccount: "Tlhama akhaonto", culture: "Setso", languages: "Maleme" },
  tw: { tagline: "Amammerɛ Mu Nkabom", createAccount: "Yɛ akontaabu", culture: "Amammerɛ", languages: "Kasa" },
};
