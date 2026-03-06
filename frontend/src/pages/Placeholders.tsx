import React from 'react';
import { useTranslation } from 'react-i18next';

export const QAWorkbench: React.FC = () => {
  const { t } = useTranslation();
  return <h1>{t('nav.qa')}</h1>;
};

export const Documents: React.FC = () => {
  const { t } = useTranslation();
  return <h1>{t('nav.docs')}</h1>;
};

export const EvidenceGraph: React.FC = () => {
  const { t } = useTranslation();
  return <h1>{t('nav.graph')}</h1>;
};

export const Evaluation: React.FC = () => {
  const { t } = useTranslation();
  return <h1>{t('nav.eval')}</h1>;
};
