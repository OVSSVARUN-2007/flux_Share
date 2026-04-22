import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
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

  const handleCustomGoogleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      googleLogin({ credential: tokenResponse.access_token }).then(() => onClose()).catch(e => setError(e.message));
    },
    onError: () => setError('Google Login Failed'),
  });

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
               <button 
                  type="button" 
                  onClick={() => handleCustomGoogleLogin()} 
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: '#fff', color: '#000', padding: '12px 24px', 
                    borderRadius: '25px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(255,255,255,0.1)', transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
               >
                 <svg width="20" height="20" viewBox="0 0 48 48">
                   <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                   <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                   <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                   <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                 </svg>
                 Sign in with Google
               </button>
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
