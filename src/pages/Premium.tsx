import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Heart, Zap, Eye, Star, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Premium = () => {
  const { t } = useLanguage();
  
  const plans = [
    {
      name: t('silver'),
      price: "$9.99",
      period: t('perMonth'),
      description: t('enhancedDating'),
      features: [
        t('unlimitedLikes'),
        t('seeWhoLikedYou'),
        `5 ${t('superLikesPerDay')}`,
        `1 ${t('boostPerMonth')}`,
        t('noAds')
      ],
      color: "silver",
      icon: Star
    },
    {
      name: t('gold'),
      price: "$19.99",
      period: t('perMonth'),
      description: t('premiumCultural'),
      features: [
        t('everythingInSilver'),
        t('unlimitedSuperLikes'),
        `5 ${t('boostsPerMonth')}`,
        t('priorityLikes'),
        t('readReceipts'),
        t('culturalMatchFilter')
      ],
      color: "gold",
      icon: Crown,
      popular: true
    },
    {
      name: t('platinum'),
      price: "$34.99",
      period: t('perMonth'),
      description: t('eliteDating'),
      features: [
        t('everythingInGold'),
        t('unlimitedBoosts'),
        t('messageBeforeMatching'),
        t('prioritySupport'),
        t('exclusiveEvents'),
        t('advancedFilters')
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
            {t('upgradeYourLoveLife')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('premiumDesc')}
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
                    {t('mostPopular')}
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
                    {t('choose')} {plan.name}
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
            <h3 className="font-semibold mb-2">{t('unlimitedLikes')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('neverRunOut')}
            </p>
          </div>
          <div className="text-center cultural-card p-6">
            <Eye className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">{t('seeWhoLikedYou')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('noMoreGuessing')}
            </p>
          </div>
          <div className="text-center cultural-card p-6">
            <Zap className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">{t('superBoosts')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('getMoreViews')}
            </p>
          </div>
          <div className="text-center cultural-card p-6">
            <Star className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">{t('culturalFilters')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('findSharedHeritage')}
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="text-center">
          <h2 className="text-2xl font-bold font-afro-heading mb-6">
            {t('faq')}
          </h2>
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="cultural-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">{t('canCancelAnytime')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('cancelDesc')}
                </p>
              </CardContent>
            </Card>
            <Card className="cultural-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">{t('paymentsSecure')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('paymentsSecureDesc')}
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