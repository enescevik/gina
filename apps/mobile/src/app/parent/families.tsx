import {useTranslation} from 'react-i18next';
import {FamilyChoicePanel} from '@/components/family-choice';
import {ParentScreen} from '@/components/ui/parent-screen';
export default function Families(){const {t}=useTranslation();return <ParentScreen title={t('experience.family.title')} subtitle={t('experience.family.short')}><FamilyChoicePanel/></ParentScreen>;}
