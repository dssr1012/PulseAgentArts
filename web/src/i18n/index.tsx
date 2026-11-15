'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';

type Locale = typeof en;
const resources: Record<string, Locale> = { en, es };

const SUPPORTED_LANGS = ['en', 'es'];
const STORAGE_KEY = 'preferred_language';

function detectLanguage(): string {
  if (typeof window === 'undefined') return 'es';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  const navLang = navigator.language?.split('-')[0];
  if (navLang && SUPPORTED_LANGS.includes(navLang)) return navLang;
  return 'es';
}

function resolveKey(obj: any, key: string): string | undefined {
  const parts = key.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

interface I18nContextValue {
  language: string;
  t: (key: string) => string;
  changeLanguage: (lang: string) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<string>('es');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLanguage(detectLanguage());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
  }, [language, mounted]);

  const t = useCallback((key: string): string => {
    const locale = resources[language];
    const value = resolveKey(locale, key);
    if (value !== undefined) return value;
    const enValue = resolveKey(resources.en, key);
    if (enValue !== undefined) return enValue;
    return key;
  }, [language]);

  const changeLanguage = useCallback((lang: string) => {
    if (SUPPORTED_LANGS.includes(lang)) {
      setLanguage(lang);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      t: (key: string) => {
        const value = resolveKey(resources.es, key);
        return value !== undefined ? value : key;
      },
      i18n: {
        language: 'es',
        changeLanguage: () => {},
      },
    };
  }
  return {
    t: ctx.t,
    i18n: {
      language: ctx.language,
      changeLanguage: ctx.changeLanguage,
    },
  };
}

const CATEGORY_MAP: Record<string, Record<string, string>> = {
  en: {
    'Alimentación': 'Food',
    'Servicios': 'Services',
    'Transporte': 'Transport',
    'Salud': 'Health',
  },
  es: {},
};

export function useCategoryName() {
  const { i18n } = useTranslation();
  return useCallback((name: string): string => {
    return CATEGORY_MAP[i18n.language]?.[name] || name;
  }, [i18n.language]);
}
