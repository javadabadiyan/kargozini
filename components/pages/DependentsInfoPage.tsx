import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Dependent } from '../../types';
import { SearchIcon, UserPlusIcon, UploadIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import EditDependentModal from '../EditDependentModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const DependentsInfoPage: React.FC = () => {
    const [dependents, setDependents] = useState<Dependent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize] = useState(15);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDependent, setEditingDependent] = useState<Partial<Dependent> | null>(null);

    const fetchDependents = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=dependents&page=${page}&pageSize=${pageSize}&searchTerm=${encodeURIComponent(search)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'خطا در دریافت اطلاعات');
            }
            const data = await response.json();
            setDependents(data.dependents || []);
            setTotalCount(data.totalCount || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    useEffect(() => {
        fetchDependents(currentPage, searchTerm);
    }, [currentPage, searchTerm, fetchDependents]);
    
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        // The useEffect will trigger the fetch
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            // Basic mapping from common Persian headers to English keys
            const keyMap: { [key: string]: keyof Dependent } = {
                'کدپرسنلی': 'personnel_code', 'كدپرسنلي': 'personnel_code', 'کد پرسنلی': 'personnel_code',
                'نام': 'first_name',
                'نام خانوادگی': 'last_name', 'نامخانوادگي': 'last_name',
                'نام پدر': 'father_name',
                'نسبت': 'relation_type',
                'تاريخ تولد': 'birth_date', 'تاریخ تولد':