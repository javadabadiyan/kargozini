
import React, { useState, useEffect } from 'react';
import type { User, Role } from '../types';
import { CloseIcon } from './icons';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Omit<User, 'id'>) => void;
  userToEdit?: User | null;
  roles: Role[];
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSave, userToEdit, roles }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
        if (userToEdit) {
            setFirstName(userToEdit.firstName);
            setLastName(userToEdit.lastName);
            setUsername(userToEdit.username);
            setRole(userToEdit.role);
            setPassword(''); // Don't pre-fill password for editing
        } else {
            // Reset form for new user
            setFirstName('');
            setLastName('');
            setUsername('');
            // Set default role to the first one in the list if available
            setRole(roles.length > 0 ? roles[0].name : '');
            setPassword('');
        }
    }
  }, [userToEdit, isOpen, roles]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !username || !role || (!userToEdit && !password)) {
        alert("لطفا تمام فیلد ها را پر کنید.");
        return;
    }
    onSave({ firstName, lastName, username, role });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-down">
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800">
            <CloseIcon/>
        </button>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">{userToEdit ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">نام</label>
              <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">نام خانوادگی</label>
              <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          </div>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">نام کاربری</label>
            <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          {!userToEdit && (
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          )}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">نقش</label>
            <select 
                id="role" 
                value={role} 
                onChange={(e) => setRole(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white" 
                required
            >
                <option value="" disabled>یک نقش انتخاب کنید</option>
                {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                ))}
            </select>
          </div>
          <div className="flex justify-end pt-4 space-x-2 space-x-reverse">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition">انصراف</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">ذخیره</button>
          </div>
        </form>
      </div>
    </div>
  );
};
