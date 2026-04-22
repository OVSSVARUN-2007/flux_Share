import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from './AuthContext';

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, googleLogin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div 
        className="glass-card modal"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="card-header">
          <h2>{isLogin ? 'Login to Flux Share' : 'Create an Account'}</h2>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <div className="card-body">
            <form onSubmit={handleSubmit} className="auth-form">
              {error && <div className="error-alert">{error}</div>}
              
              <div className="input-group" style={{ textAlign: 'left' }}>
                 <label style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem', display: 'block' }}>Email</label>
                 <input 
                   type="email" 
                   required
                   className="modern-input" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                 />
              </div>
              <div className="input-group mt-4" style={{ textAlign: 'left' }}>
                 <label style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem', display: 'block' }}>Password</label>
                 <input 
                   type="password" 
                   required
                   className="modern-input" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                 />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary w-full mt-6"
                disabled={loading}
              >
                {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
              </button>
            </form>
            
            <div className="divider">
                <span>OR</span>
            </div>
            
            <div className="google-auth-container" style={{ display: 'flex', justifyContent: 'center' }}>
               <GoogleLogin
                  onSuccess={credentialResponse => {
                     googleLogin(credentialResponse).then(() => onClose()).catch(e => setError(e.message));
                  }}
                  onError={() => {
                     setError('Google Login Failed');
                  }}
                  theme="filled_black"
                  shape="pill"
               />
            </div>
            
            <p className="auth-switch" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button type="button" className="text-link" onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: '#9d4edd', cursor: 'pointer', fontWeight: 'bold' }}>
                   {isLogin ? "Sign Up" : "Login"}
                </button>
            </p>
        </div>
      </motion.div>
    </div>
  );
}
