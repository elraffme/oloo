import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const TermsOfService = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-6 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('back')}
        </Button>

        <h1 className="text-4xl font-bold mb-2">{t('termsOfServicePageTitle')}</h1>
        <p className="text-muted-foreground mb-8">{t('lastUpdated')}: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="font-semibold mb-4 text-xl">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By creating an account and using Òloo ("the Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our service. We reserve the right to modify these 
              terms at any time, and your continued use constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">2. Eligibility</h2>
            <p className="leading-relaxed mb-2">
              You must be at least 18 years old to use Òloo. By creating an account, you represent and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are at least 18 years of age</li>
              <li>You have the legal capacity to enter into this agreement</li>
              <li>You will comply with all applicable laws and regulations</li>
              <li>You have never been convicted of a felony or sex crime</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">3. Account Security</h2>
            <p className="leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to notify 
              us immediately of any unauthorized access or security breach. Òloo cannot be held liable for losses 
              resulting from unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">4. User Conduct</h2>
            <p className="leading-relaxed mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Impersonate any person or entity</li>
              <li>Post false, misleading, or fraudulent information</li>
              <li>Share explicit content without consent</li>
              <li>Solicit money or financial information from other users</li>
              <li>Use automated systems or bots to access the Service</li>
              <li>Engage in commercial activities without our permission</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">5. Content Guidelines</h2>
            <p className="leading-relaxed">
              You retain ownership of content you post on Òloo, but grant us a worldwide, non-exclusive license to use, 
              display, and distribute your content within the Service. You represent that you have all necessary rights 
              to post your content. We reserve the right to remove any content that violates these terms or community 
              guidelines.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">6. Premium Services</h2>
            <p className="leading-relaxed">
              Premium subscriptions are billed in advance on a recurring basis. You may cancel at any time, but no 
              refunds will be provided for partial periods. Premium features are subject to change, and we reserve 
              the right to modify pricing with advance notice.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">7. Termination</h2>
            <p className="leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violation of these terms, 
              illegal activity, or behavior that harms other users or the Service. You may delete your account at 
              any time through your profile settings.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">8. Disclaimers</h2>
            <p className="leading-relaxed">
              Òloo is provided "as is" without warranties of any kind. We do not guarantee that the Service will be 
              uninterrupted, secure, or error-free. We are not responsible for the conduct of users or the accuracy 
              of profile information. You assume all risks associated with meeting people online.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">9. Limitation of Liability</h2>
            <p className="leading-relaxed">
              To the maximum extent permitted by law, Òloo shall not be liable for any indirect, incidental, special, 
              or consequential damages arising from your use of the Service. Our total liability shall not exceed the 
              amount you paid to us in the past 12 months.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">10. Governing Law</h2>
            <p className="leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be 
              resolved through binding arbitration, except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-4 text-xl">11. Contact</h2>
            <p className="leading-relaxed">For questions about these Terms of Service, please contact us at legal@oloo.media</p>
          </section>
        </div>
      </div>
    </div>;
};
export default TermsOfService;