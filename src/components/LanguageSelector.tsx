import React from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslation } from 'react-i18next';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const AFRICAN_LANGUAGES: Language[] = [
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

interface LanguageSelectorProps {
  variant?: 'default' | 'ghost';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  variant = 'ghost',
  className = ''
}) => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  const currentLanguage = AFRICAN_LANGUAGES.find(lang => lang.code === i18n.language);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant={variant} 
          className={`justify-start text-base font-afro-heading text-foreground font-medium hover:bg-primary/25 hover:text-primary-foreground transition-all duration-200 ${className}`}
        >
          <Globe className="w-4 h-4 mr-2" />
          {t('landing.menu.language')}: {currentLanguage?.nativeName}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
            {t('landing.menu.selectLanguage')}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {AFRICAN_LANGUAGES.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`
                  w-full flex items-center justify-between px-2 py-2 rounded-md
                  text-sm hover:bg-accent transition-colors
                  ${i18n.language === language.code ? 'bg-accent' : ''}
                `}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{language.nativeName}</span>
                  <span className="text-xs text-muted-foreground">{language.name}</span>
                </div>
                {i18n.language === language.code && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
