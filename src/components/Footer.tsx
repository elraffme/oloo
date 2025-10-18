import { Instagram, Facebook, Twitter, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();
  
  return (
    <footer className="mt-auto py-12 px-6 bg-secondary/10 border-t border-border">
      <div className="max-w-6xl mx-auto">
        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8 text-sm">
          <a href="/about" className="text-muted-foreground hover:text-foreground transition-colors">{t('about')}</a>
          <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">{t('privacyPolicy')}</a>
          <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">{t('termsConditions')}</a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t('faqs')}</a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t('support')}</a>
        </div>

        {/* Social Media Icons */}
        <div className="flex justify-center gap-6 mb-8">
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram">
            <Instagram className="w-6 h-6" />
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Facebook">
            <Facebook className="w-6 h-6" />
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
            <Twitter className="w-6 h-6" />
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="LinkedIn">
            <Linkedin className="w-6 h-6" />
          </a>
        </div>

        {/* Newsletter Signup */}
        <div className="max-w-md mx-auto mb-8">
          <p className="text-center text-sm text-muted-foreground mb-4">
            {t('newsletterText')}
          </p>
          <div className="flex gap-2">
            <Input 
              type="email" 
              placeholder={t('enterEmail')}
              className="bg-background"
            />
            <Button className="nsibidi-gradient text-primary-foreground">
              {t('subscribe')}
            </Button>
          </div>
        </div>

        {/* Legal Text */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          {t('footerLegalText')}{' '}
          <a href="/terms" className="underline hover:text-foreground transition-colors">{t('termsOfService')}</a>. 
          {' '}{t('learnDataProcessing')}{' '}
          <a href="/privacy" className="underline hover:text-foreground transition-colors">{t('privacyPolicy')}</a> {t('and')}{' '}
          <a href="/cookies" className="underline hover:text-foreground transition-colors">{t('cookiesPolicy')}</a>.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
