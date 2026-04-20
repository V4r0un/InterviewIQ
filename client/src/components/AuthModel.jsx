import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaTimes } from 'react-icons/fa';
import Auth from '../pages/Auth';

const AuthModel = ({ onClose }) => {
    const { userData } = useSelector((state) => state.user);

    useEffect(() => {
        if (userData) {
            onClose();
        }
    }, [userData, onClose]);

    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto">
            <div className="relative w-full max-w-md mx-auto">
                <button className="absolute top-8 right-5 text-gray-800 hover:text-black text-xl"onClick={onClose}>
                    <FaTimes size={18} />
                </button>
                <Auth isModel={true} />
            </div>
        </div>
    );
};

export default AuthModel;