import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
const PrivacyPolicy = () => {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-6 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="font-bold mb-2 text-3xl text-yellow-900">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="leading-relaxed mb-4 text-[#afaa9d]">
              We collect information you provide directly to us when you create an account, complete your profile, 
              and use Òloo. This includes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#afaa9d]">
              <li><strong>Profile Information:</strong> Name, age, gender, location, photos, bio, interests, and preferences</li>
              <li><strong>Account Data:</strong> Email address, phone number (optional), password</li>
              <li><strong>Communication:</strong> Messages sent through the platform, interactions with other users</li>
              <li><strong>Premium Features:</strong> Payment information (processed securely through third-party providers)</li>
              <li><strong>Device Information:</strong> IP address, device type, browser type, operating system</li>
              <li><strong>Usage Data:</strong> Pages viewed, features used, time spent, swipe patterns</li>
              <li><strong>Location Data:</strong> Approximate location for matching purposes (if enabled)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="leading-relaxed mb-2 text-[#afaa9d]">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2 text-[#afaa9d]">
              <li>Provide and improve our dating services</li>
              <li>Match you with compatible users based on preferences and location</li>
              <li>Enable communication between users</li>
              <li>Verify user identity and prevent fraud</li>
              <li>Process premium subscriptions and payments</li>
              <li>Send important notifications about matches, messages, and account activity</li>
              <li>Personalize your experience and show relevant content</li>
              <li>Analyze usage patterns to improve our service</li>
              <li>Enforce our Terms of Service and community guidelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <p className="leading-relaxed mb-4 text-[#afaa9d]">
              We do not sell your personal information. We may share your information in these situations:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#afaa9d]">
              <li><strong>With Other Users:</strong> Your profile information is visible to users who match your preferences</li>
              <li><strong>Service Providers:</strong> Third-party companies that help us operate our service (hosting, analytics, payment processing)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="leading-relaxed text-[#afaa9d]">
              We implement industry-standard security measures to protect your information, including encryption, 
              secure servers, and regular security audits. However, no method of transmission over the internet is 
              100% secure. We cannot guarantee absolute security but are committed to protecting your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Your Privacy Rights</h2>
            <p className="leading-relaxed mb-2 text-[#afaa9d]">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-[#afaa9d]">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Data Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Restrict Processing:</strong> Limit how we use your information</li>
            </ul>
            <p className="leading-relaxed mt-4 text-[#afaa9d]">To exercise these rights, contact us at privacy@oloo.media or through your account settings.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="leading-relaxed text-[#afaa9d]">
              We retain your information as long as your account is active or as needed to provide services. 
              After account deletion, we may retain certain data for legal compliance, fraud prevention, and 
              dispute resolution purposes. Most data is deleted within 90 days of account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Children's Privacy</h2>
            <p className="leading-relaxed text-[#afaa9d]">
              Òloo is not intended for users under 18 years of age. We do not knowingly collect information from 
              minors. If we discover that a user is underage, we will immediately delete their account and data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. International Users</h2>
            <p className="leading-relaxed text-[#afaa9d]">
              Your information may be transferred to and processed in countries other than your own. We comply with 
              applicable data protection laws and implement appropriate safeguards for international transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p className="leading-relaxed text-[#afaa9d]">
              We may update this Privacy Policy periodically. We will notify you of significant changes via email 
              or in-app notification. Your continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
            <p className="leading-relaxed text-[#afaa9d]">For questions or concerns about privacy, contact our Data Protection Officer at privacy@oloo.media</p>
          </section>
        </div>
      </div>
    </div>;
};
export default PrivacyPolicy;