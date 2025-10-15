import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'nsibidi': ['Kalam', 'cursive'],
				'afro-display': ['Pacifico', 'cursive'],
				'afro-heading': ['Righteous', 'sans-serif'],
				'afro-body': ['Ubuntu', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Premium membership tier colors
				silver: {
					DEFAULT: 'hsl(var(--silver))',
					foreground: 'hsl(var(--silver-foreground))'
				},
				gold: {
					DEFAULT: 'hsl(var(--gold))',
					foreground: 'hsl(var(--gold-foreground))'
				},
				platinum: {
					DEFAULT: 'hsl(var(--platinum))',
					foreground: 'hsl(var(--platinum-foreground))'
				},
				// Verification color
				orange: {
					500: 'hsl(var(--orange-verified))',
					600: 'hsl(var(--orange-verified))',
					foreground: 'hsl(var(--orange-verified-foreground))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				// Dating app specific animations
				'swipe-right': {
					'0%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
					'100%': { transform: 'translateX(100vw) rotate(30deg)', opacity: '0' }
				},
				'swipe-left': {
					'0%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
					'100%': { transform: 'translateX(-100vw) rotate(-30deg)', opacity: '0' }
				},
				'float-hearts': {
					'0%': { transform: 'translateY(0px) rotate(0deg)', opacity: '0.7' },
					'50%': { transform: 'translateY(-20px) rotate(180deg)', opacity: '1' },
					'100%': { transform: 'translateY(-40px) rotate(360deg)', opacity: '0' }
				},
				'pulse-glow': {
					'0%, 100%': { boxShadow: '0 0 5px hsl(var(--primary))', transform: 'scale(1)' },
					'50%': { boxShadow: '0 0 20px hsl(var(--primary)), 0 0 30px hsl(var(--primary))', transform: 'scale(1.05)' }
				},
				'premium-shine': {
					'0%': { backgroundPosition: '-200% center' },
					'100%': { backgroundPosition: '200% center' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'swipe-right': 'swipe-right 0.6s ease-in-out forwards',
				'swipe-left': 'swipe-left 0.6s ease-in-out forwards',
				'float-hearts': 'float-hearts 3s ease-in-out infinite',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'premium-shine': 'premium-shine 2s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
