import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchIcon, UserIcon, UsersIcon, DocumentPlusIcon, DocumentIcon, DownloadIcon, TrashIcon, UploadIcon } from '../icons/Icons';
import type { Personnel, PersonnelDocument } from '../../types';

const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URI prefix (e.g., "data:image/png;base64,")
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};

const DocumentUploadPage: React.FC = () => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
    const [documents, setDocuments] = useState<PersonnelDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    
    const [newDocumentTitle, setNewDocumentTitle] = useState('');
    const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                setPersonnelLoading(true);
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('خطا در دریافت لیست پرسنل');
                const data = await response.json();
                setPersonnelList(data.personnel || []);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد' });
            } finally {
                setPersonnelLoading(false);
            }
        };
        fetchPersonnel();
    }, []);

    const fetchDocuments = async (personnelCode: string) => {
        try {
            setDocumentsLoading(true);
            setDocuments([]);
            const response = await fetch(`/api/personnel?type=documents&personnel_code=${personnelCode}`);
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در دریافت مدارک');
            const data = await response.json();
            setDocuments(data.documents || []);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد' });
        } finally {
            setDocumentsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedPersonnel) {
            fetchDocuments(selectedPersonnel.personnel_code);
        } else {
            setDocuments([]);
        }
    }, [selectedPersonnel]);

    const filteredPersonnel = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase().trim();
        if (!lowercasedTerm) return personnelList;
        return personnelList.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
            p.personnel_code.toLowerCase().includes(lowercasedTerm) ||
            (p.national_id && p.national_id.toLowerCase().includes(lowercasedTerm))
        );
    }, [personnelList, searchTerm]);
    
    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDocumentFile || !newDocumentTitle || !selectedPersonnel) {
            setStatus({ type: 'error', message: 'لطفاً عنوان و فایل مدرک را انتخاب کنید.'});
            return;
        }
        setUploading(true);
        setStatus({ type: 'info', message: 'در حال آپلود مدرک...'});
        try {
            const base64Data = await fileToBase64(newDocumentFile);
            const payload = {
                personnel_code: selectedPersonnel.personnel_code,
                title: newDocumentTitle,
                file_name: newDocumentFile.name,
                file_type: newDocumentFile.type,
                file_data: base64Data,
            };
            const response = await fetch('/api/personnel?type=documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            
            setStatus({ type: 'success', message: 'مدرک با موفقیت آپلود شد.'});
            setDocuments(prev => [data.document, ...prev]);
            setNewDocumentFile(null);
            setNewDocumentTitle('');
            if(fileInputRef.current) fileInputRef.current.value = "";
            
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در آپلود فایل' });
        } finally {
            setUploading(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleFileDelete = async (docId: number) => {
        if (!window.confirm('آیا از حذف این مدرک اطمینان دارید؟')) return;
        setStatus({ type: 'info', message: 'در حال حذف مدرک...'});
        try {
            const response = await fetch(`/api/personnel?type=documents&id=${docId}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: 'مدرک با موفقیت حذف شد.'});
            setDocuments(prev => prev.filter(doc => doc.id !== docId));
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف فایل' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleFileDownload = async (doc: PersonnelDocument) => {
        try {
            const response = await fetch(`/api/personnel?type=document_data&id=${doc.id}`);
            if (!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            const base64Data = data.document.file_data;

            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: doc.file_type });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = doc.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
             setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در دانلود فایل' });
        }
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">بارگذاری و مدیریت مدارک پرسنل</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label htmlFor="search-personnel" className="block text-sm font-medium text-gray-700 mb-2">۱. انتخاب پرسنل</label>
                    <div className="relative">
                        <input type="text" id="search-personnel" className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    <div className="mt-4 max-h-96 overflow-y-auto">
                        {personnelLoading ? <p className="text-center text-gray-500">در حال بارگذاری...</p> : (
                            <ul className="space-y-2">
                                {filteredPersonnel.map(person => (
                                    <li key={person.id} onClick={() => setSelectedPersonnel(person)} className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${selectedPersonnel?.id === person.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}>
                                        <UserIcon className="w-5 h-5 ml-2" /> {person.first_name} {person.last_name}
                                    </li>
                                ))}
                                {filteredPersonnel.length === 0 && <p className="text-center text-gray-500">پرسنلی یافت نشد.</p>}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2">
                    {!selectedPersonnel ? (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-full flex items-center justify-center">
                            <div className="text-center text-gray-400">
                                <DocumentPlusIcon className="w-16 h-16 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold">مدیریت مدارک</h3>
                                <p className="text-sm">برای شروع، یک پرسنل را از لیست انتخاب کنید.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">۲. بارگذاری مدرک جدید برای: {selectedPersonnel.first_name} {selectedPersonnel.last_name}</h3>
                                <form onSubmit={handleFileUpload} className="space-y-4">
                                    <div>
                                        <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700 mb-1">عنوان مدرک</label>
                                        <input id="doc-title" type="text" value={newDocumentTitle} onChange={e => setNewDocumentTitle(e.target.value)} placeholder="مثال: قرارداد کاری ۱۴۰۳" className="w-full p-2 border border-gray-300 rounded-md" required disabled={uploading} />
                                    </div>
                                    <div>
                                        <label htmlFor="doc-file" className="block text-sm font-medium text-gray-700 mb-1">فایل</label>
                                        <input id="doc-file" type="file" ref={fileInputRef} onChange={e => setNewDocumentFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" required disabled={uploading} />
                                    </div>
                                    <button type="submit" disabled={uploading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                                        <UploadIcon className="w-5 h-5"/> {uploading ? 'در حال آپلود...' : 'بارگذاری مدرک'}
                                    </button>
                                </form>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">۳. لیست مدارک</h3>
                                {documentsLoading ? <p className="text-center py-4">در حال بارگذاری...</p> : documents.length === 0 ? <p className="text-center py-4 text-gray-500">هیچ مدرکی برای این پرسنل ثبت نشده است.</p> : (
                                    <ul className="space-y-3">
                                        {documents.map(doc => (
                                            <li key={doc.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <DocumentIcon className="w-6 h-6 text-gray-500" />
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{doc.title}</p>
                                                        <p className="text-xs text-gray-500">{doc.file_name} - تاریخ ثبت: {toPersianDigits(new Date(doc.uploaded_at).toLocaleDateString('fa-IR'))}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleFileDownload(doc)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="دانلود"><DownloadIcon className="w-5 h-5"/></button>
                                                    <button onClick={() => handleFileDelete(doc.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="حذف"><TrashIcon className="w-5 h-5"/></button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentUploadPage;