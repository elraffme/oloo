import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
const About = () => {
  const navigate = useNavigate();
  return <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-amber-50 text-lg font-medium">About Òloo</h1>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <section>
            <h2 className="text-3xl font-afro-heading text-primary mb-4">Cultured in Connection</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Òloo is a premium dating platform designed to celebrate African culture while fostering meaningful connections across the diaspora.
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-4 text-yellow-900">Our Mission</h3>
            <p className="leading-relaxed text-muted-foreground">
              We believe in bringing people together through shared values, cultural appreciation, and authentic connections. 
              Òloo provides a safe, secure, and culturally-rich environment for individuals to find meaningful relationships.
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-4 text-yellow-900">What Makes Us Different</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">Cultural celebration at the heart of every connection</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">Advanced verification systems for safety and authenticity</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">Premium features designed for meaningful relationships</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span className="text-muted-foreground">Community-focused platform with real-time connections</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-4">Contact Us</h3>
            <p className="leading-relaxed text-muted-foreground">
              Have questions or feedback? We'd love to hear from you at{' '}
              <a href="mailto:hello@oloo.media" className="text-primary hover:underline">
                hello@oloo.media
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>;
};
export default About;