import React from 'react';
import type { MenuItem } from '../types';
import { HomeIcon, UsersIcon, CircleIcon, DocumentTextIcon, BriefcaseIcon, ShieldCheckIcon, DocumentReportIcon, CogIcon, DocumentPlusIcon, ClipboardDocumentListIcon } from './icons/Icons';
import PersonnelListPage from './pages/PersonnelListPage';
import DependentsInfoPage from './pages/DependentsInfoPage';
import PlaceholderPage from './pages/PlaceholderPage';
import CommutingMembersPage from './pages/CommutingMembersPage';
import LogCommutePage from './pages/LogCommutePage';
import CommuteReportPage from './pages/CommuteReportPage';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import AccountingCommitmentPage from './pages/AccountingCommitmentPage';
import DisciplinaryCommitteePage from './pages/DisciplinaryCommitteePage';
import JobGroupPage from './pages/JobGroupPage';
import SendPerformanceReviewPage from './pages/SendPerformanceReviewPage';
import ArchivePerformanceReviewPage from './pages/ArchivePerformanceReviewPage';
import EnterBonusPage from './pages/EnterBonusPage';

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
        id: 'accounting_commitment',
        label: 'نامه تعهد حسابداری', 
        icon: DocumentReportIcon,
        page: AccountingCommitmentPage
      },
      { id: 'disciplinary_committee', label: 'کمیته تشویق و انضباطی', icon: CircleIcon, page: DisciplinaryCommitteePage },
      { 
        id: 'performance_review', 
        label: 'ارزیابی عملکرد', 
        icon: DocumentReportIcon,
        children: [
            { id: 'send_performance_review', label: 'ارسال ارزیابی عملکرد پرسنل', icon: CircleIcon, page: SendPerformanceReviewPage },
            { id: 'archive_performance_review', label: 'بایگانی ارزیابی عملکرد پرسنل', icon: CircleIcon, page: ArchivePerformanceReviewPage }
        ]
      },
      { id: 'job_group', label: 'گروه شغلی پرسنل', icon: ClipboardDocumentListIcon, page: JobGroupPage },
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