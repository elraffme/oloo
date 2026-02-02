import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Check } from 'lucide-react';
interface Language {
  code: string;
  name: string;
  nativeName: string;
}
const LANGUAGES: Language[] = [{
  code: 'en',
  name: 'English',
  nativeName: 'English'
}, {
  code: 'fr',
  name: 'French',
  nativeName: 'Français'
}, {
  code: 'sw',
  name: 'Swahili',
  nativeName: 'Kiswahili'
}, {
  code: 'pt',
  name: 'Portuguese',
  nativeName: 'Português'
}, {
  code: 'ar',
  name: 'Arabic',
  nativeName: 'العربية'
}, {
  code: 'am',
  name: 'Amharic',
  nativeName: 'አማርኛ'
}, {
  code: 'ha',
  name: 'Hausa',
  nativeName: 'Hausa'
}, {
  code: 'ig',
  name: 'Igbo',
  nativeName: 'Igbo'
}, {
  code: 'yo',
  name: 'Yoruba',
  nativeName: 'Yorùbá'
}, {
  code: 'zu',
  name: 'Zulu',
  nativeName: 'isiZulu'
}, {
  code: 'xh',
  name: 'Xhosa',
  nativeName: 'isiXhosa'
}, {
  code: 'af',
  name: 'Afrikaans',
  nativeName: 'Afrikaans'
}, {
  code: 'so',
  name: 'Somali',
  nativeName: 'Soomaali'
}];
const LANGUAGE_SELECTED_KEY = 'oloo_language_selected';
export const LanguageSelectionModal: React.FC = () => {
  const {
    i18n
  } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  useEffect(() => {
    // Check if user has already selected a language
    const hasSelectedLanguage = localStorage.getItem(LANGUAGE_SELECTED_KEY);
    if (!hasSelectedLanguage) {
      setIsOpen(true);
      // Default to browser language or English
      const browserLang = i18n.language?.split('-')[0] || 'en';
      const supportedLang = LANGUAGES.find(l => l.code === browserLang);
      setSelectedLanguage(supportedLang ? browserLang : 'en');
    }
  }, [i18n.language]);
  const handleLanguageSelect = (code: string) => {
    setSelectedLanguage(code);
  };
  const handleConfirm = async () => {
    await i18n.changeLanguage(selectedLanguage);
    localStorage.setItem(LANGUAGE_SELECTED_KEY, 'true');
    localStorage.setItem('i18nextLng', selectedLanguage);
    setIsOpen(false);
  };
  return <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg bg-[#0a0a0f]/90 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/50 p-0 overflow-hidden" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        {/* Subtle gradient overlay at top */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="relative px-8 pt-10 pb-8 bg-transparent">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-white/5">
              <Globe className="w-8 h-8 text-primary/80" />
            </div>
            <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">
              Choose Your Language
            </h2>
            <p className="text-white/50 text-sm">
              Select your preferred language for the best experience
            </p>
          </div>

          {/* Language Grid */}
          <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {LANGUAGES.map(language => <button key={language.code} onClick={() => handleLanguageSelect(language.code)} className={`group flex items-center justify-between px-2.5 py-2 rounded-xl border transition-all duration-200 text-left ${selectedLanguage === language.code ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/5' : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'}`}>
                <div className="min-w-0">
                  <p className={`font-medium text-sm truncate ${selectedLanguage === language.code ? 'text-white' : 'text-white/80'}`}>
                    {language.nativeName}
                  </p>
                  <p className={`text-xs truncate ${selectedLanguage === language.code ? 'text-white/60' : 'text-white/40'}`}>
                    {language.name}
                  </p>
                </div>
                <div className={`flex-shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${selectedLanguage === language.code ? 'bg-primary text-primary-foreground' : 'bg-white/5 group-hover:bg-white/10'}`}>
                  {selectedLanguage === language.code && <Check className="w-3 h-3" />}
                </div>
              </button>)}
          </div>

          {/* Confirm Button */}
          <Button onClick={handleConfirm} className="w-full mt-6 h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium rounded-xl transition-all duration-200 shadow-lg shadow-primary/20">
            Continue
          </Button>
          
          {/* Footer hint */}
          <p className="text-center text-white/30 text-xs mt-4">
            You can change this later in settings
          </p>
        </div>
      </DialogContent>
    </Dialog>;
};
export default LanguageSelectionModal;