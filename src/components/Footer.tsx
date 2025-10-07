import { Instagram, Facebook, Twitter, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Footer = () => {
  return (
    <footer className="mt-auto py-12 px-6 bg-secondary/10 border-t border-border">
      <div className="max-w-6xl mx-auto">
        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8 text-sm">
          <a href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
          <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms & Conditions</a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">FAQs</a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Support</a>
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
            Stay up to date with exclusive cultural events and matchmaking tips. Sign up for our newsletter
          </p>
          <div className="flex gap-2">
            <Input 
              type="email" 
              placeholder="Enter your email" 
              className="bg-background"
            />
            <Button className="nsibidi-gradient text-primary-foreground">
              Subscribe
            </Button>
          </div>
        </div>

        {/* Legal Text */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          By tapping 'Sign in' / 'Create account', you agree to our{' '}
          <a href="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</a>. 
          Learn how we process your data in our{' '}
          <a href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</a> and{' '}
          <a href="/cookies" className="underline hover:text-foreground transition-colors">Cookies Policy</a>.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
