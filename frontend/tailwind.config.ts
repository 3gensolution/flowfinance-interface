import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AwinFi Design System Colors (Navy Blue-First Design)

        // Primary Background - White
        background: {
          DEFAULT: '#FFFFFF',
          light: '#F9FAFB',
          dark: '#080F2B',
        },

        // Text Colors
        text: {
          DEFAULT: '#0B1B2B',
          dark: '#0B1B2B',
          muted: '#6B7280',
          light: '#9CA3AF',
        },

        // Primary Brand Accent - Awin Orange (#EE7C1D)
        orange: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EE7C1D',
          600: '#DC6A14',
          700: '#C2570C',
          800: '#9A4509',
          900: '#7C3907',
          950: '#431C03',
        },

        // Secondary Accent - Awin Teal (#2FB9BB)
        teal: {
          50: '#F0FDFD',
          100: '#CCFBFB',
          200: '#99F6F6',
          300: '#5EEAEC',
          400: '#2DD4D6',
          500: '#2FB9BB',
          600: '#0D9496',
          700: '#0F7577',
          800: '#115E5F',
          900: '#134E4F',
          950: '#042F30',
        },

        // Supporting Blue - Awin Blue (#1361A8)
        blue: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1361A8',
          600: '#1055A0',
          700: '#0D4A8E',
          800: '#0A3A70',
          900: '#082F5C',
          950: '#041B36',
        },

        // Neutral White (#F8F8F9)
        white: {
          DEFAULT: '#F8F8F9',
          soft: '#F8F8F9',
          pure: '#FFFFFF',
        },

        // Muted Burgundy (#805153) - Warnings
        burgundy: {
          50: '#FDF2F2',
          100: '#FCE4E4',
          200: '#FACACA',
          300: '#F5A3A5',
          400: '#EE7274',
          500: '#805153',
          600: '#6E4546',
          700: '#5C3A3B',
          800: '#4D3132',
          900: '#422C2D',
          950: '#241516',
        },

        // Legacy color aliases for backward compatibility
        primary: {
          50: '#F0FDFD',
          100: '#CCFBFB',
          200: '#99F6F6',
          300: '#5EEAEC',
          400: '#2DD4D6',
          500: '#2FB9BB',
          600: '#0D9496',
          700: '#0F7577',
          800: '#115E5F',
          900: '#134E4F',
          950: '#042F30',
        },
        accent: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EE7C1D',
          600: '#DC6A14',
          700: '#C2570C',
          800: '#9A4509',
          900: '#7C3907',
          950: '#431C03',
        },
        secondary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1361A8',
          600: '#1055A0',
          700: '#0D4A8E',
          800: '#0A3A70',
          900: '#082F5C',
          950: '#041B36',
        },
        navy: {
          50: '#E8EAF0',
          100: '#C5CAD9',
          200: '#9EA7BF',
          300: '#7784A5',
          400: '#596992',
          500: '#3B4F7E',
          600: '#354876',
          700: '#2D3F6B',
          800: '#263661',
          900: '#080F2B',
          950: '#050A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero': ['clamp(2.25rem, 5vw, 4rem)', { lineHeight: '1.1', fontWeight: '700' }],
        'hero-sub': ['clamp(1rem, 2vw, 1.25rem)', { lineHeight: '1.6', fontWeight: '400' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #080F2B 0%, #0D1638 50%, #080F2B 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s ease infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.6s ease-out forwards',
        'count-up': 'countUp 2s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)', filter: 'blur(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        countUp: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(238, 124, 29, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(238, 124, 29, 0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glow-orange': '0 0 20px rgba(238, 124, 29, 0.3)',
        'glow-orange-lg': '0 0 40px rgba(238, 124, 29, 0.4)',
        'glow-teal': '0 0 20px rgba(47, 185, 187, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      transitionTimingFunction: {
        'power2-out': 'cubic-bezier(0.33, 1, 0.68, 1)',
        'power3-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
export default config
