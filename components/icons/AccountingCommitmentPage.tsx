import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Personnel, CommitmentLetter } from '../../types';
import { SearchIcon, PrinterIcon, RefreshIcon, DocumentReportIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, DocumentIcon } from '../icons/Icons';
import EditCommitmentLetterModal from '../EditCommitmentLetterModal';


const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
              .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '۰';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};


const AccountingCommitmentPage: React.FC = () => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuarantor, setSelectedGuarantor] = useState<Personnel | null>(null);

    const [recipientName, setRecipientName] = useState('');
    const [recipientNationalId, setRecipientNationalId] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [branchName, setBranchName] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [decreeFactors, setDecreeFactors] = useState('');
    
    const [totalCommitted, setTotalCommitted] = useState(0);
    const [loadingCommitment, setLoadingCommitment] = useState(false);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    
    const [archivedLetters, setArchivedLetters] = useState<CommitmentLetter[]>([]);
    const [archiveLoading, setArchiveLoading] = useState(true);
    const [archiveError, setArchiveError] = useState<string | null>(null);
    const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
    const [expandedGuarantors, setExpandedGuarantors] = useState<Set<string>>(new Set());

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLetter, setEditingLetter] = useState<CommitmentLetter | null>(null);
    const [isPrintingArchived, setIsPrintingArchived] = useState(false);

    const [archiveCurrentPage, setArchiveCurrentPage] = useState(1);
    const ARCHIVE_PAGE_SIZE = 10;
    
    // State for layout adjustment
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragInfo = useRef<{ isDragging: boolean; startX: number; startY: number; initialX: number; initialY: number; }>({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    const printRef = useRef<HTMLDivElement>(null);

    // Load/Save layout position
    useEffect(() => {
        const savedPosition = localStorage.getItem('commitmentLetterPosition');
        if (savedPosition) {
            setPosition(JSON.parse(savedPosition));
        }
    }, []);

    const handleSavePosition = () => {
        localStorage.setItem('commitmentLetterPosition', JSON.stringify(position));
        setStatus({ type: 'success', message: 'موقعیت جدید نامه ذخیره شد.' });
        setIsAdjusting(false);
        setTimeout(() => setStatus(null), 3000);
    };

    const handleResetPosition = () => {
        localStorage.removeItem('commitmentLetterPosition');
        setPosition({ x: 0, y: 0 });
