import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReactNode } from "react";

interface FaqItem {
  question: string;
  answer: ReactNode;
}

const faqItems: FaqItem[] = [
  {
    question: "What is Òloo?",
    answer: "Òloo is a dating platform designed specifically for the African diaspora, celebrating cultural connections and helping you find meaningful relationships rooted in shared heritage."
  },
  {
    question: "How do I create an account?",
    answer: "Simply click 'Join Now' on the homepage, enter your email or phone number, and follow the onboarding steps to set up your profile with photos, interests, and preferences."
  },
  {
    question: "Is Òloo free to use?",
    answer: (
      <>
        Òloo offers a free tier with basic features. Premium memberships unlock additional features like unlimited likes, advanced filters, and priority visibility.{" "}
        <Link to="/app/premium" className="text-primary underline hover:opacity-80">
          View Premium plans →
        </Link>
      </>
    )
  },
  {
    question: "How does the matching system work?",
    answer: "Our matching algorithm considers your preferences, interests, location, and cultural background to suggest compatible profiles. The more you interact, the better your matches become."
  },
  {
    question: "How do I verify my profile?",
    answer: "Go to your profile settings and select 'Verify Profile'. You'll be asked to take a selfie that matches your profile photos. Verified profiles get a badge and increased visibility."
  },
  {
    question: "Can I use Òloo for live streaming?",
    answer: "Yes! Òloo features live streaming where you can broadcast to the community, interact with viewers, and receive virtual gifts. Go to the Streaming section to get started."
  },
  {
    question: "What are coins and how do I earn them?",
    answer: "Coins are our in-app currency used for sending gifts, boosting your profile, and unlocking premium features. Earn coins through daily logins, trivia games, or purchase them directly."
  },
  {
    question: "How do I report inappropriate behavior?",
    answer: "Tap the three dots on any profile or message and select 'Report'. Our moderation team reviews all reports within 24 hours and takes appropriate action."
  },
  {
    question: "Can I delete my account?",
    answer: "Yes, you can delete your account anytime from Settings > Account > Delete Account. This action is permanent and all your data will be removed."
  },
  {
    question: "How do I contact support?",
    answer: "For any issues or questions, email us at support@oloo.app or use the in-app chat support available in your profile settings."
  }
];

const Faq = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold font-afro-heading text-center mb-4">
            <span className="nsibidi-gradient bg-clip-text text-transparent">
              Frequently Asked Questions
            </span>
          </h1>
          <p className="text-center text-muted-foreground mb-12">
            Find answers to common questions about Òloo
          </p>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-lg px-6"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Still have questions?
            </p>
            <a
              href="mailto:support@oloo.app"
              className="inline-flex items-center justify-center px-6 py-3 nsibidi-gradient text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Contact Support
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Faq;
