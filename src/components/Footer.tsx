import { useState } from "react";
import { Instagram, Facebook, Twitter, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate subscription (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    toast({
      title: "Subscribed!",
      description: "Thank you for subscribing to our newsletter",
    });
    
    setEmail("");
    setIsSubmitting(false);
  };

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
              className="bg-background text-white placeholder:text-white/70"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
            />
            <Button 
              className="nsibidi-gradient text-primary-foreground"
              onClick={handleSubscribe}
              disabled={isSubmitting}
            >
              {isSubmitting ? "..." : "Subscribe"}
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
