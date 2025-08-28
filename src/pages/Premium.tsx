import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Heart, Zap, Eye, Star, Check } from "lucide-react";

const Premium = () => {
  const plans = [
    {
      name: "Silver",
      price: "$9.99",
      period: "/month",
      description: "Enhanced dating experience",
      features: [
        "Unlimited likes",
        "See who liked you",
        "5 Super Likes per day",
        "1 Boost per month",
        "No ads"
      ],
      color: "silver",
      icon: Star
    },
    {
      name: "Gold",
      price: "$19.99",
      period: "/month",
      description: "Premium cultural connections",
      features: [
        "Everything in Silver",
        "Unlimited Super Likes",
        "5 Boosts per month",
        "Priority likes",
        "Read receipts",
        "Cultural match filter"
      ],
      color: "gold",
      icon: Crown,
      popular: true
    },
    {
      name: "Platinum",
      price: "$34.99",
      period: "/month",
      description: "Elite dating experience",
      features: [
        "Everything in Gold",
        "Unlimited Boosts",
        "Message before matching",
        "Priority customer support",
        "Exclusive events access",
        "Advanced filters"
      ],
      color: "platinum",
      icon: Zap
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="heart-logo mx-auto mb-6 scale-150">
            <span className="logo-text">Ò</span>
          </div>
          <h1 className="text-4xl font-bold font-afro-heading mb-4">
            Upgrade Your Love Life
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock premium features and find meaningful connections with people who share your cultural values
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => {
            const IconComponent = plan.icon;
            return (
              <Card key={index} className={`membership-card ${plan.color} relative ${plan.popular ? 'scale-105' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <IconComponent className="w-12 h-12 mx-auto mb-4" />
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="opacity-90">
                    {plan.description}
                  </CardDescription>
                  <div className="text-3xl font-bold mt-4">
                    {plan.price}
                    <span className="text-lg font-normal opacity-70">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2">
                        <Check className="w-4 h-4 opacity-70" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full bg-white/20 hover:bg-white/30 text-current border-0">
                    Choose {plan.name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Highlight */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="text-center cultural-card p-6">
            <Heart className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Unlimited Likes</h3>
            <p className="text-sm text-muted-foreground">
              Never run out of chances to connect
            </p>
          </div>
          <div className="text-center cultural-card p-6">
            <Eye className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">See Who Likes You</h3>
            <p className="text-sm text-muted-foreground">
              No more guessing - see your admirers
            </p>
          </div>
          <div className="text-center cultural-card p-6">
            <Zap className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Super Boosts</h3>
            <p className="text-sm text-muted-foreground">
              Get 10x more profile views
            </p>
          </div>
          <div className="text-center cultural-card p-6">
            <Star className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Cultural Filters</h3>
            <p className="text-sm text-muted-foreground">
              Find matches who share your heritage
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="text-center">
          <h2 className="text-2xl font-bold font-afro-heading mb-6">
            Frequently Asked Questions
          </h2>
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="cultural-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes, you can cancel your subscription at any time. No questions asked.
                </p>
              </CardContent>
            </Card>
            <Card className="cultural-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Are payments secure?</h3>
                <p className="text-sm text-muted-foreground">
                  Absolutely. We use industry-standard encryption to protect your payment information.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Premium;