import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Crown, Gem, Sparkles, Video, Heart, Star } from "lucide-react";

const membershipTiers = [
  {
    name: "Silver",
    price: "$1.99",
    period: "/month",
    description: "Essential features for meaningful connections",
    features: [
      "Unlimited likes",
      "See who liked you",
      "Priority matching",
      "Advanced filters",
      "Monthly boost"
    ],
    icon: Sparkles,
    gradient: "membership-card silver",
    popular: false
  },
  {
    name: "Gold",
    price: "$4.99",
    period: "/month",
    description: "Premium experience with exclusive streaming",
    features: [
      "All Silver features",
      "Live streaming access",
      "Video calls",
      "Premium badges",
      "Weekly boosts",
      "VIP customer support"
    ],
    icon: Crown,
    gradient: "membership-card gold",
    popular: true
  },
  {
    name: "Platinum",
    price: "$9.99",
    period: "/month",
    description: "Ultimate luxury dating experience",
    features: [
      "All Gold features",
      "Exclusive events access",
      "Personal matchmaker",
      "Premium-only browsing",
      "Daily boosts",
      "Profile verification priority",
      "Luxury concierge service"
    ],
    icon: Gem,
    gradient: "membership-card platinum",
    popular: false
  }
];

const MembershipTiers = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-secondary/20" id="premium">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 romantic-gradient rounded-full flex items-center justify-center">
              <Crown className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-gold via-primary to-platinum bg-clip-text text-transparent">
              Premium Memberships
            </span>
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock exclusive features and elevate your dating experience with our premium tiers
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {membershipTiers.map((tier, index) => {
            const IconComponent = tier.icon;
            
            return (
              <Card 
                key={tier.name}
                className={`${tier.gradient} relative overflow-hidden transition-all duration-300 hover:scale-105 ${tier.popular ? 'ring-2 ring-gold shadow-2xl' : ''}`}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gold text-gold-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon and Title */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                    <p className="text-sm opacity-90">{tier.description}</p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center mb-8">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold">{tier.price}</span>
                      <span className="text-lg opacity-75">{tier.period}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-8">
                    {tier.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <div className="w-5 h-5 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button 
                    className={`w-full py-3 font-semibold transition-all duration-300 ${
                      tier.popular 
                        ? 'bg-white text-gold hover:bg-white/90 hover:scale-105' 
                        : 'bg-white/20 backdrop-blur-sm hover:bg-white/30 hover:scale-105'
                    }`}
                  >
                    {tier.popular ? (
                      <>
                        <Heart className="w-4 h-4 mr-2" />
                        Start Premium
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        Upgrade Now
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">All plans include 7-day free trial</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span>✓ Cancel anytime</span>
            <span>✓ No hidden fees</span>
            <span>✓ Secure payments</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MembershipTiers;