import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

const About = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex h-14 items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">{t('aboutOloo')}</h1>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <section>
            <h2 className="text-3xl font-afro-heading text-primary mb-4">{t('culturedConnection')}</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t('aboutDesc')}
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-4">{t('ourMission')}</h3>
            <p className="leading-relaxed text-muted-foreground">
              {t('missionDesc')}
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-4">{t('whatMakesDifferent')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">{t('culturalCelebration')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">{t('advancedVerification')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">{t('premiumFeatures')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">{t('communityFocused')}</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-4">{t('contactUs')}</h3>
            <p className="leading-relaxed text-muted-foreground">
              {t('contactDesc')}{' '}
              <a href="mailto:hello@oloo.media" className="text-primary hover:underline">
                hello@oloo.media
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
