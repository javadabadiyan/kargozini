
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserTable } from './UserTable';
import { AddUserModal } from './AddUserModal';
import { PlusIcon } from './icons';
import { SettingsPage } from './SettingsPage';
import type { User, Role } from '../types';

export const DashboardPage: React.FC = () => {
  const [activePage, setActivePage] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error(error);
      alert("خطا در بارگذاری لیست کاربران!");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
     try {
      const response = await fetch('/api/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error(error);
      alert("خطا در بارگذاری لیست نقش‌ها!");
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const handleOpenModal = (user: User | null = null) => {
    setUserToEdit(user);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setUserToEdit(null);
  };

  const handleSaveUser = async (userData: Omit<User, 'id'>) => {
    const isEditing = !!userToEdit;
    const body = isEditing ? { ...userData, id: userToEdit!.id } : userData;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save user');
        }
        
        const savedUser: User = await response.json();

        if (isEditing) {
            setUsers(users.map(u => (u.id === savedUser.id ? savedUser : u)));
        } else {
            setUsers([savedUser, ...users]);
        }
        handleCloseModal();
    } catch (error) {
        console.error("Save user error:", error);
        alert(`خطا در ذخیره سازی کاربر: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('آیا از حذف این کاربر اطمینان دارید؟')) {
      try {
        const response = await fetch(`/api/users?id=${userId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to delete user');

        setUsers(users.filter(user => user.id !== userId));
      } catch (error) {
        console.error("Delete user error:", error);
        alert("خطا در حذف کاربر!");
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden mr-64">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8">
          <div className="container mx-auto">
            {activePage === 'users' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-semibold text-gray-700">لیست کاربران</h1>
                  <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                  >
                    <PlusIcon className="w-5 h-5 ml-2" />
                    افزودن کاربر جدید
                  </button>
                </div>
                {isLoading ? (
                  <div className="w-full bg-white rounded-lg shadow p-12 text-center text-gray-500">
                    در حال بارگذاری کاربران...
                  </div>
                ) : (
                  <UserTable users={users} onEdit={handleOpenModal} onDelete={handleDeleteUser} />
                )}
              </div>
            )}
             {activePage === 'settings' && (
              <SettingsPage roles={roles} onRolesChange={fetchRoles} />
            )}
          </div>
        </main>
      </div>
      {activePage === 'users' && (
        <AddUserModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          onSave={handleSaveUser}
          userToEdit={userToEdit}
          roles={roles}
        />
      )}
    </div>
  );
};
