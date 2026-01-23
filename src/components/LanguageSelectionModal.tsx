import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Check } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
];

const LANGUAGE_SELECTED_KEY = 'oloo_language_selected';

export const LanguageSelectionModal: React.FC = () => {
  const { i18n, t } = useTranslation();
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

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Globe className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-afro-heading">
            {t('languageModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('languageModal.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto py-4">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageSelect(language.code)}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                selectedLanguage === language.code
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div>
                <p className="font-medium text-sm">{language.nativeName}</p>
                <p className="text-xs text-muted-foreground">{language.name}</p>
              </div>
              {selectedLanguage === language.code && (
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        <Button 
          onClick={handleConfirm} 
          className="w-full nsibidi-gradient text-primary-foreground"
        >
          {t('languageModal.confirm')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default LanguageSelectionModal;
