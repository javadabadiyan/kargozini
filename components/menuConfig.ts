import React from 'react';
import type { MenuItem } from '../types';
import { HomeIcon, UsersIcon, CircleIcon, DocumentTextIcon, BriefcaseIcon, ShieldCheckIcon, DocumentReportIcon, CogIcon, DocumentPlusIcon } from './icons/Icons';
import PersonnelListPage from './pages/PersonnelListPage';
import DependentsInfoPage from './pages/DependentsInfoPage';
import PlaceholderPage from './pages/PlaceholderPage';
import CommutingMembersPage from './pages/CommutingMembersPage';
import LogCommutePage from './pages/LogCommutePage';
import CommuteReportPage from './pages/CommuteReportPage';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import DocumentUploadPage from './pages/DocumentUploadPage';

const AccountingCommitmentPage: React.FC = () => React.createElement(PlaceholderPage, { title: "صدور نامه تعهد حسابداری" });
const CommitmentLetterArchivePage: React.FC = () => React.createElement(PlaceholderPage, { title: "بایگانی نامه ها" });
const DisciplinaryCommitteePage: React.FC = () => React.createElement(PlaceholderPage, { title: "کمیته تشویق و انضباطی" });
const PerformanceReviewPage: React.FC = () => React.createElement(PlaceholderPage, { title: "ارزیابی عملکرد" });
const JobGroupPage: React.FC = () => React.createElement(PlaceholderPage, { title: "گروه شغلی پرسنل" });
const EnterBonusPage: React.FC = () => React.createElement(PlaceholderPage, { title: "وارد کردن کارانه" });
const BonusAnalyzerPage: React.FC = () => React.createElement(PlaceholderPage, { title: "تحلیلگر هوشمند کارانه" });

export const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: HomeIcon, page: DashboardPage },
  { 
    id: 'personnel', label: 'مدیریت پرسنل', icon: UsersIcon,
    children: [
      { id: 'personnel_list', label: 'لیست پرسنل', icon: CircleIcon, page: PersonnelListPage },
      { id: 'dependents_info', label: 'اطلاعات بستگان', icon: CircleIcon, page: DependentsInfoPage },
      { id: 'document_upload', label: 'بارگذاری مدارک', icon: DocumentPlusIcon, page: DocumentUploadPage }
    ]
  },
  { 
    id: 'recruitment', label: 'کارگزینی', icon: BriefcaseIcon,
    children: [
      { 
        id: 'accounting_commitment_parent',
        label: 'نامه تعهد حسابداری', 
        icon: DocumentReportIcon,
        children: [
          { id: 'accounting_commitment', label: 'صدور نامه تعهد', icon: CircleIcon, page: AccountingCommitmentPage },
          { id: 'commitment_letter_archive', label: 'بایگانی نامه ها', icon: CircleIcon, page: CommitmentLetterArchivePage }
        ]
      },
      { id: 'disciplinary_committee', label: 'کمیته تشویق و انضباطی', icon: CircleIcon, page: DisciplinaryCommitteePage },
      { id: 'performance_review', label: 'ارزیابی عملکرد', icon: CircleIcon, page: PerformanceReviewPage },
      { id: 'job_group', label: 'گروه شغلی پرسنل', icon: CircleIcon, page: JobGroupPage },
      {
        id: 'bonus_management', label: 'مدیریت کارانه', icon: DocumentReportIcon,
        children: [
            { id: 'enter_bonus', label: 'وارد کردن کارانه', icon: CircleIcon, page: EnterBonusPage },
            { id: 'bonus_analyzer', label: 'تحلیلگر هوشمند کارانه', icon: CircleIcon, page: BonusAnalyzerPage }
        ]
      }
    ]
  },
  {
    id: 'security', label: 'حراست', icon: ShieldCheckIcon,
    children: [
      { id: 'commuting_members', label: 'کارمندان عضو تردد', icon: CircleIcon, page: CommutingMembersPage },
      { id: 'log_commute', label: 'ثبت تردد', icon: CircleIcon, page: LogCommutePage },
      { id: 'commute_report', label: 'گزارش گیری تردد', icon: DocumentReportIcon, page: CommuteReportPage }
    ]
  },
  { id: 'settings', label: 'تنظیمات', icon: CogIcon, page: SettingsPage }
];