import type { MenuItem } from '../types';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CogIcon,
  BriefcaseIcon,
  DocumentReportIcon,
  ClipboardDocumentListIcon,
  UserPlusIcon,
  ClockIcon,
  DocumentIcon,
  DocumentPlusIcon,
} from './icons/Icons';

// Page imports
import DashboardPage from './pages/DashboardPage';
import PersonnelListPage from './pages/PersonnelListPage';
import DependentsInfoPage from './pages/DependentsInfoPage';
import CommutingMembersPage from './pages/CommutingMembersPage';
import LogCommutePage from './pages/LogCommutePage';
import CommuteReportPage from './pages/CommuteReportPage';
import UserManagementPage from './pages/UserManagementPage';
import SettingsPage from './pages/SettingsPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import AccountingCommitmentPage from './pages/AccountingCommitmentPage';
import CommitmentLetterArchivePage from './pages/CommitmentLetterArchivePage';
import DisciplinaryCommitteePage from './pages/DisciplinaryCommitteePage';
import JobGroupPage from './pages/JobGroupPage';
import SendPerformanceReviewPage from './pages/SendPerformanceReviewPage';
import ArchivePerformanceReviewPage from './pages/ArchivePerformanceReviewPage';
import EnterBonusPage from './pages/EnterBonusPage';
import SubmittedBonusesPage from './pages/SubmittedBonusesPage';


export const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: HomeIcon, page: DashboardPage },
  {
    id: 'personnel',
    label: 'امور پرسنل',
    icon: UsersIcon,
    children: [
      { id: 'personnel_list', label: 'لیست پرسنل', icon: UsersIcon, page: PersonnelListPage },
      { id: 'dependents_info', label: 'اطلاعات تکمیلی', icon: UserPlusIcon, page: DependentsInfoPage },
      { id: 'job_group_info', label: 'اطلاعات گروه شغلی', icon: BriefcaseIcon, page: JobGroupPage },
      { id: 'personnel_documents', label: 'مدارک پرسنل', icon: DocumentUploadPage, page: DocumentUploadPage },
    ],
  },
  {
    id: 'bonuses',
    label: 'ارسال کارانه',
    icon: DocumentReportIcon,
    children: [
        { id: 'enter_bonus', label: 'ارسال کارانه', icon: DocumentPlusIcon, page: EnterBonusPage },
        { id: 'submitted_bonuses', label: 'بایگانی کارانه', icon: DocumentIcon, page: SubmittedBonusesPage },
    ]
  },
  {
    id: 'security',
    label: 'حراست و نگهبانی',
    icon: ShieldCheckIcon,
    children: [
      { id: 'log_commute', label: 'ثبت تردد روزانه', icon: ClockIcon, page: LogCommutePage },
      { id: 'commuting_members', label: 'اعضای مجاز تردد', icon: UsersIcon, page: CommutingMembersPage },
      { id: 'commute_reports', label: 'گزارشات تردد', icon: DocumentTextIcon, page: CommuteReportPage },
    ],
  },
  {
    id: 'committees',
    label: 'کمیته‌ها و امور مالی',
    icon: ClipboardDocumentListIcon,
    children: [
        { id: 'disciplinary_committee', label: 'کمیته انضباطی', icon: ShieldCheckIcon, page: DisciplinaryCommitteePage },
        { id: 'commitment_letter', label: 'نامه تعهد کسر حقوق', icon: DocumentReportIcon, page: AccountingCommitmentPage },
        { id: 'commitment_archive', label: 'بایگانی تعهدات', icon: DocumentTextIcon, page: CommitmentLetterArchivePage },
    ],
  },
  {
    id: 'performance_review',
    label: 'ارزیابی عملکرد',
    icon: DocumentReportIcon,
    children: [
        { id: 'send_performance_review', label: 'ارسال فرم ارزیابی', icon: DocumentPlusIcon, page: SendPerformanceReviewPage },
        { id: 'archive_performance_review', label: 'بایگانی ارزیابی‌ها', icon: DocumentIcon, page: ArchivePerformanceReviewPage },
    ]
  },
  {
    id: 'system',
    label: 'سیستم',
    icon: CogIcon,
    children: [
      { id: 'user_management', label: 'مدیریت کاربران', icon: UsersIcon, page: UserManagementPage },
      { id: 'settings', label: 'تنظیمات', icon: CogIcon, page: SettingsPage },
    ],
  },
];