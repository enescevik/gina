import {useTranslation} from 'react-i18next';
import {FamilyHub} from '@/components/family/family-hub';
import {ParentScreen} from '@/components/ui/parent-screen';

/** Switching between families and joining another family are separate actions; nothing is merged. */
export default function Families(){const {t}=useTranslation();return <ParentScreen title={t('u02.family.title')} subtitle={t('u02.family.short')}><FamilyHub/></ParentScreen>;}
