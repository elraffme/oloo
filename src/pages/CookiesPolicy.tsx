import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
const CookiesPolicy = () => {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-6 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Cookies Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies</h2>
            <p className="leading-relaxed">
              Cookies are small text files stored on your device when you visit Òloo. They help us provide, protect, 
              and improve our service by remembering your preferences, analyzing usage patterns, and enabling essential 
              features. Similar technologies like web beacons, pixels, and local storage may also be used.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Types of Cookies We Use</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">Essential Cookies</h3>
                <p className="leading-relaxed">
                  These cookies are necessary for the website to function properly. They enable core features like 
                  account authentication, security, and basic navigation. You cannot opt out of essential cookies 
                  as the service would not work without them.
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Session management and login authentication</li>
                  <li>Security and fraud prevention</li>
                  <li>Load balancing</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Functional Cookies</h3>
                <p className="leading-relaxed">
                  These cookies remember your preferences and choices to provide an enhanced, personalized experience.
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Language and region preferences</li>
                  <li>Display settings (light/dark mode)</li>
                  <li>Notification preferences</li>
                  <li>Recently viewed profiles</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Analytics Cookies</h3>
                <p className="leading-relaxed">
                  These cookies help us understand how users interact with Òloo, allowing us to improve the service.
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Page views and navigation patterns</li>
                  <li>Feature usage and engagement metrics</li>
                  <li>Error tracking and performance monitoring</li>
                  <li>A/B testing for new features</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Marketing Cookies</h3>
                <p className="leading-relaxed">
                  These cookies track your activity to show relevant advertisements and measure campaign effectiveness.
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Targeted advertising based on interests</li>
                  <li>Retargeting campaigns</li>
                  <li>Social media integration</li>
                  <li>Conversion tracking</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Third-Party Cookies</h2>
            <p className="leading-relaxed mb-4">
              We work with trusted third-party services that may place cookies on your device:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Analytics Providers:</strong> Google Analytics, Mixpanel (for usage insights)</li>
              <li><strong>Payment Processors:</strong> Stripe, PayPal (for secure transactions)</li>
              <li><strong>Social Media:</strong> Facebook, Instagram, Twitter (for social features)</li>
              <li><strong>Advertising Networks:</strong> Google Ads, Meta Ads (for targeted advertising)</li>
              <li><strong>Infrastructure:</strong> CDN providers for faster content delivery</li>
            </ul>
            <p className="leading-relaxed mt-4">
              These third parties have their own privacy policies governing their use of cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Cookie Duration</h2>
            <p className="leading-relaxed mb-4">Cookies may be temporary or persistent:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
              <li><strong>Persistent Cookies:</strong> Remain on your device for a set period (typically 30 days to 2 years) 
              or until you delete them</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Managing Cookie Preferences</h2>
            <p className="leading-relaxed mb-4">You have several options to manage cookies:</p>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Browser Settings</h3>
                <p className="leading-relaxed">
                  Most browsers allow you to block or delete cookies through their settings. However, disabling cookies 
                  may affect website functionality. Consult your browser's help documentation for specific instructions:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Chrome: Settings → Privacy and security → Cookies</li>
                  <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
                  <li>Safari: Preferences → Privacy → Cookies and website data</li>
                  <li>Edge: Settings → Cookies and site permissions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Opt-Out Tools</h3>
                <p className="leading-relaxed">
                  You can opt out of certain advertising cookies using:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Digital Advertising Alliance (DAA): www.aboutads.info/choices</li>
                  <li>Network Advertising Initiative (NAI): www.networkadvertising.org/choices</li>
                  <li>European Interactive Digital Advertising Alliance: www.youronlinechoices.eu</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Do Not Track</h3>
                <p className="leading-relaxed">
                  Some browsers offer "Do Not Track" signals. Currently, there is no industry standard for responding 
                  to these signals, so we do not respond to Do Not Track requests.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Mobile Devices</h2>
            <p className="leading-relaxed">
              Mobile devices may use advertising identifiers instead of cookies. You can limit ad tracking on:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>iOS:</strong> Settings → Privacy → Advertising → Limit Ad Tracking</li>
              <li><strong>Android:</strong> Settings → Google → Ads → Opt out of Ads Personalization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Updates to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Cookies Policy to reflect changes in technology, legislation, or our practices. 
              We will notify you of significant changes and update the "Last updated" date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
            <p className="leading-relaxed">For questions about our use of cookies, contact us at privacy@oloo.media</p>
          </section>
        </div>
      </div>
    </div>;
};
export default CookiesPolicy;