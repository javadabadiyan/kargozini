import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { AppUser } from '../../types';
import { SearchIcon, UserPlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import UserEditModal from '../UserEditModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const UserManagementPage: React.FC = () => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);

    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'خطا در دریافت لیست کاربران');
            }
            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleOpenModal = (user: AppUser | null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingUser(null);
        setIsModalOpen(false);
    };

    const handleSaveUser = async (user: AppUser) => {
        const isNew = !user.id;
        const url = '/api/users';
        const method = isNew ? 'POST' : 'PUT';
        
        setStatus({ type: 'info', message: isNew ? 'در حال افزودن کاربر...' : 'در حال ویرایش کاربر...' });

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.details || data.error);
            setStatus({ type: 'success', message: data.message });
            handleCloseModal();
            fetchUsers(); // Refresh the list
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره کاربر' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleDeleteUser = async (user: AppUser) => {
        if (user.id === currentUser.id) {
            alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.');
            return;
        }

        if (window.confirm(`آیا از حذف کاربر "${user.username}" اطمینان دارید؟`)) {
            setStatus({ type: 'info', message: 'در حال حذف کاربر...'});
            try {
                const response = await fetch('/api/users', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: user.id }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.details || data.error);
                setStatus({ type: 'success', message: data.message });
                fetchUsers(); // Refresh list
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف کاربر' });
            } finally {
                 setTimeout(() => setStatus(null), 5000);
            }
        }
    };

    const filteredUsers = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase().trim();
        if (!lowercasedTerm) return users;
        return users.filter(user =>
            user.username.toLowerCase().includes(lowercasedTerm) ||
            user.full_name?.toLowerCase().includes(lowercasedTerm)
        );
    }, [users, searchTerm]);

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">مدیریت کاربران سیستم</h2>
                <button
                    onClick={() => handleOpenModal(null)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                >
                    <UserPlusIcon className="w-5 h-5"/>
                    افزودن کاربر جدید
                </button>
            </div>

            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="mb-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="جستجوی کاربر بر اساس نام کاربری یا نام کامل..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">نام کاربری</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">نام کامل</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading && <tr><td colSpan={3} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {error && <tr><td colSpan={3} className="text-center p-4 text-red-500">{error}</td></tr>}
                        {!loading && !error && filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-slate-200">{user.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-300">{user.full_name || '---'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    <button onClick={() => handleOpenModal(user)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full transition-colors" title="ویرایش">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDeleteUser(user)} className="p-2 mr-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors" title="حذف">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {!loading && filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        هیچ کاربری یافت نشد.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <UserEditModal
                    user={editingUser}
                    onClose={handleCloseModal}
                    onSave={handleSaveUser}
                />
            )}
        </div>
    );
};

export default UserManagementPage;