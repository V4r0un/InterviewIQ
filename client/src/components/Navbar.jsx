import React, { useState } from 'react'
import { motion } from 'motion/react'
import { useDispatch, useSelector } from 'react-redux'
import { BsRobot, BsCoin } from 'react-icons/bs'
import { HiOutlineLogout } from 'react-icons/hi'
import { FaUserAstronaut } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../App'
import { setUserData } from '../redux/userSlice'
import AuthModel from './AuthModel'

const Navbar = () => {
    const { userData } = useSelector((state)=>state.user)
    const [showCreditPopUp, setShowCreditPopUp] = useState(false)
    const [showUserPopUp, setShowUserPopUp] = useState(false)
    const [showAuth, setShowAuth] = useState(false)
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const userInitial = userData?.name 
        ? userData.name.slice(0,1).toUpperCase() 
        : '';


    const handleLogout = async () => {
        try {
            await axios.get(serverUrl + '/api/auth/logout', {withCredentials:true})
            dispatch(setUserData(null))
            setShowCreditPopUp(false)
            setShowUserPopUp(true)
            navigate('/')
        } catch (error) {
            console.log(error)
        }
    }
  return (
    <div className='bg-[#f3f3f3] flex justify-center px-4 pt-6'>
        <motion.div
            initial={{opacity:0, y:-40}}
            animate={{opacity:1, y:0}}
            transition={{duration:0.3}}
            className='w-full max-w-6xl bg-white rounded-3xl shadow-sm border border-gray-200 px-8 py-4 flex justify-between items-center relative'>
                <div className='flex items-center gap-3 cursor-pointer'>
                    <div className='bg-black text-white p-2 rounded-lg'>
                        <BsRobot size={18}/>
                    </div>
                    <h1 className='font-semibold hidden md:block text-lg'>InterviewIQ.AI</h1>
                </div>
                <div className='flex items-center gap-6 relative'>
                    <div className='relative'>
                        <button className='flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200 transition' onClick={()=>{
                            if (!userData) {
                                setShowAuth(true)
                                return
                            }
                            setShowCreditPopUp(!showCreditPopUp)
                            setShowUserPopUp(false)
                            }}>
                            <BsCoin size={20}/>
                            {userData?.credits || 0}
                        </button>
                        {showCreditPopUp && (
                            <div className='absolute -right-12.5 mt-3 w-64 bg-white shadow-xl border border-gray-200 rounded-xl p-5 z-50'>
                                <p className='text-sm text-gray-600 mb-4'>Need more credits to continue interview?</p>
                                <button className='w-full bg-black text-white py-2 rounded-lg text-sm' onClick={()=>navigate('/pricing')}>Buy more credits</button>
                            </div>)}
                    </div>
                    <div className='relative'>
                        <button className='w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-semibold' onClick={()=>{
                            if (!userData) {
                                setShowAuth(true)
                                return
                            }
                            setShowUserPopUp(!showUserPopUp)
                            setShowCreditPopUp(false)
                            }}>
                            {userData ? userInitial : <FaUserAstronaut size={18}/>}
                        </button>
                        {showUserPopUp && (
                            <div className=' absolute right-0 mt-3 w-48 bg-white shadow-xl border border-gray-200 rounded-xl p-4 z-50'>
                                <p className='text-md text-blue-500 font-medium mb-1'>{userData?.name}</p>
                                <button className='w-full text-left text-sm py-2 hover:text-black text-gray-600' onClick={()=>navigate('/history')}>Interview History</button>
                                <button className='w-full text-left text-sm py-2 flex items-center gap-2 text-red-500' onClick={handleLogout}><HiOutlineLogout size={18}/> Logout</button>
                            </div>
                        )}
                    </div>
                </div>
        </motion.div>
        {showAuth && <AuthModel onClose={()=>setShowAuth(false)}/>}
    </div>
  )
}

export default Navbar
