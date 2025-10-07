const Footer = () => {
  return (
    <footer className="mt-auto py-8 px-6 bg-secondary/10">
      <div className="max-w-4xl mx-auto">
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
