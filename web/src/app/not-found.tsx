'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-pulse-blue-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <span className="text-white font-bold text-2xl">P</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('notFound.title')}</h1>
        <h2 className="text-lg font-medium text-gray-600 mb-6">{t('notFound.pageNotFound')}</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
          {t('notFound.description')}
        </p>
        <Link href="/dashboard" className="btn-primary">
          {t('notFound.goToDashboard')}
        </Link>
      </div>
    </div>
  );
}
