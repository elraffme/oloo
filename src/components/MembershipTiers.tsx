import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Crown, Gem, Sparkles, Video, Heart, Star } from "lucide-react";

const membershipTiers = [
  {
    name: "Free",
    price: "Free",
    period: "",
    description: "Start your cultural journey",
    features: [
      "Limited swipes per day",
      "Standard chat after matching",
      "View low-resolution streams",
      "Basic profile features"
    ],
    icon: Heart,
    gradient: "membership-card bg-muted",
    popular: false,
    tier: "free"
  },
  {
    name: "Silver",
    price: "$4.99",
    period: "/month",
    description: "Enhanced connections and streaming",
    features: [
      "Unlimited swipes",
      "See who liked you",
      "Access to public HD streams",
      "Advanced filters",
      "Priority matching"
    ],
    icon: Sparkles,
    gradient: "membership-card silver",
    popular: false,
    tier: "silver"
  },
  {
    name: "Gold",
    price: "$9.99",
    period: "/month",
    description: "Premium streaming and exclusive access",
    features: [
      "All Silver perks",
      "Unlimited HD streaming",
      "Priority profile placement",
      "Exclusive members-only events/streams",
      "Weekly boosts",
      "Premium badges"
    ],
    icon: Crown,
    gradient: "membership-card gold",
    popular: true,
    tier: "gold"
  },
  {
    name: "Platinum",
    price: "$19.99",
    period: "/month",
    description: "Ultimate luxury dating experience",
    features: [
      "All Gold perks",
      "Verified badge",
      "Profile boosting every week",
      "1:1 private video chats without matching",
      "Personal matchmaker access",
      "Luxury concierge service"
    ],
    icon: Gem,
    gradient: "membership-card platinum",
    popular: false,
    tier: "platinum"
  }
];

const MembershipTiers = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-secondary/20 african-pattern-bg" id="premium">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 romantic-gradient rounded-full flex items-center justify-center">
              <Crown className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-afro-heading mb-6">
            <span className="nsibidi-gradient bg-clip-text text-transparent">
              <span className="nsibidi-symbol">◊</span> Premium Memberships <span className="nsibidi-symbol">◊</span>
            </span>
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-afro-body">
            Unlock exclusive cultural features and elevate your dating experience with our heritage-rich premium tiers
            <div className="text-base font-nsibidi text-primary/60 mt-2">
              ⟡ ◈ ⬟ Cultural Connections Await ⬟ ◈ ⟡
            </div>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {membershipTiers.map((tier, index) => {
            const IconComponent = tier.icon;
            
            return (
              <Card 
                key={tier.name}
                className={`${tier.gradient} relative overflow-hidden transition-all duration-300 hover:scale-105 cultural-card ${tier.popular ? 'ring-2 ring-gold shadow-2xl' : ''}`}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="nsibidi-gradient text-primary-foreground px-4 py-1 rounded-full text-sm font-afro-body flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      <span className="nsibidi-symbol">◈</span>
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon and Title */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 cultural-pattern">
                      <IconComponent className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-afro-heading mb-2">
                      <span className="nsibidi-symbol mr-2">◊</span>
                      {tier.name}
                    </h3>
                    <p className="text-sm opacity-90 font-afro-body">{tier.description}</p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center mb-8">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-afro-heading">{tier.price}</span>
                      <span className="text-lg opacity-75 font-afro-body">{tier.period}</span>
                    </div>
                    <div className="font-nsibidi text-sm text-primary/60 mt-1">
                      ⟡ Cultural Value ⟡
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-8">
                    {tier.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <div className="w-5 h-5 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-sm font-afro-body">
                          <span className="nsibidi-symbol text-xs mr-1">◈</span>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button 
                    className={`w-full py-3 font-afro-body transition-all duration-300 ${
                      tier.popular 
                        ? 'bg-white text-gold hover:bg-white/90 hover:scale-105' 
                        : 'bg-white/20 backdrop-blur-sm hover:bg-white/30 hover:scale-105'
                    }`}
                  >
                    {tier.popular ? (
                      <>
                        <Heart className="w-4 h-4 mr-2" />
                        <span className="nsibidi-symbol mr-2">♦</span>
                        Start Premium
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        <span className="nsibidi-symbol mr-2">⬟</span>
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
          <p className="text-muted-foreground mb-4 font-afro-body">
            <span className="nsibidi-symbol">⟡</span> All plans include 7-day free trial <span className="nsibidi-symbol">⟡</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground font-afro-body">
            <span><span className="nsibidi-symbol">◈</span> Cancel anytime</span>
            <span><span className="nsibidi-symbol">◊</span> No hidden fees</span>
            <span><span className="nsibidi-symbol">⬟</span> Secure payments</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MembershipTiers;