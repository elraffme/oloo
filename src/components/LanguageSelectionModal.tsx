import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
];

const LANGUAGE_SELECTED_KEY = 'oloo_language_selected';

export const LanguageSelectionModal: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  useEffect(() => {
    // Check if user has already selected a language
    const hasSelected = localStorage.getItem(LANGUAGE_SELECTED_KEY);
    if (!hasSelected) {
      setIsOpen(true);
      // Default to English or detected language
      setSelectedLanguage(i18n.language || 'en');
    }
  }, [i18n.language]);

  const handleLanguageSelect = (code: string) => {
    setSelectedLanguage(code);
  };

  const handleConfirm = async () => {
    // Change language
    i18n.changeLanguage(selectedLanguage);
    
    // Mark as selected in localStorage
    localStorage.setItem(LANGUAGE_SELECTED_KEY, 'true');
    localStorage.setItem('i18nextLng', selectedLanguage);
    
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full nsibidi-gradient flex items-center justify-center mb-3">
            <Globe className="w-7 h-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-xl font-afro-heading text-center">
            Choose Your Language
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Select your preferred language for the best experience
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto py-4 px-1">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageSelect(language.code)}
              className={`
                relative flex flex-col items-center justify-center p-3 rounded-lg
                border-2 transition-all duration-200
                ${selectedLanguage === language.code 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }
              `}
            >
              {selectedLanguage === language.code && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="font-medium text-foreground text-sm">
                {language.nativeName}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {language.name}
              </span>
            </button>
          ))}
        </div>
        
        <div className="pt-2">
          <Button 
            onClick={handleConfirm}
            className="w-full h-12 nsibidi-gradient text-primary-foreground font-semibold rounded-full"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LanguageSelectionModal;
