import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, ArrowDownLeft, X, File, ShieldCheck, Zap, User, LogOut } from 'lucide-react';
import { usePeerTransfer } from './usePeerTransfer';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import './index.css';

export default function App() {
  const [view, setView] = useState('home'); // home, send, receive
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading, logout } = useAuth();
  const {
    peerId, status, progress, errorMsg, fileMeta, downloadUrl,
    initSender, initReceiver, reset
  } = usePeerTransfer();
  
  const fileInputRef = useRef(null);
  const [receiverId, setReceiverId] = useState('');
  const [expiryTimer, setExpiryTimer] = useState(7 * 60);

  // Automatically switch to receive mode if a URL parameter exists, but strictly enforce Auth
  useEffect(() => {
    // Only act after auth resolves
    if (loading) return; 

    const params = new URLSearchParams(window.location.search);
    const recId = params.get('receive');
    if (recId) {
       setView('receive');
       setReceiverId(recId);
       logAction('receive');
    }
  }, [loading, user]);

  // Automatic download logic for receiver
  useEffect(() => {
    if (status === 'complete' && downloadUrl && view === 'receive') {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileMeta?.name || 'flux-transfer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [status, downloadUrl, view, fileMeta]);

  useEffect(() => {
    let interval;
    if (view === 'send' && status === 'ready') {
      setExpiryTimer(7 * 60);
      interval = setInterval(() => {
        setExpiryTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            reset();
            setView('home');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, status, reset]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  const handleHome = () => {
    reset();
    setView('home');
  };

  const onFileChange = (e) => {
    if (e.target.files.length > 0) {
      initSender(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      initSender(e.dataTransfer.files[0]);
    }
  };

  const logAction = async (type) => {
    try {
      const url = new URL('/api/transfers/log', window.location.origin);
      url.searchParams.append('action_type', type);
      if (user?.id) url.searchParams.append('user_id', user.id);
      
      await fetch(url, { method: 'POST' });
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  };

  const handleSend = () => {
    setView('send');
    logAction('send');
  };

  const handleReceive = () => {
    setView('receive');
    logAction('receive');
  };

  const startReceive = () => {
    initReceiver(receiverId);
  };

  return (
    <div className="app-container">
      {/* Background bubbles */}
      <div className="background-bubbles">
        <div className="bubble b1"></div>
        <div className="bubble b2"></div>
        <div className="bubble b3"></div>
      </div>
      
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h2 className="logo-text" onClick={handleHome} style={{ cursor: 'pointer' }}>Flux <span className="highlight">Share</span></h2>
        </motion.div>
        
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
           {user ? (
             <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                   <User size={18}/> {user.email.split('@')[0]}
                </span>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={logout}>
                   <LogOut size={16}/> Logout
                </button>
             </div>
           ) : (
             <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setShowAuthModal(true)}>
               Login / Sign Up
             </button>
           )}
        </motion.div>
      </header>

      <main className="main-content">
        <AnimatePresence mode="wait">
          
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="hero-view"
            >
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Lightning Fast <br/> <span className="highlight">P2P Delivery</span> ⚡
              </motion.h1>
              <motion.p 
                className="subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Transfer files up to 500MB securely and directly between devices. No limits, no sign-ups.
              </motion.p>
              
              <div className="features">
                <div className="feature"><Zap size={20} /> Real-time peer connection</div>
                <div className="feature"><ShieldCheck size={20} /> End-to-end encrypted</div>
              </div>

              <div className="buttons-group">
                <button className="btn btn-primary" onClick={handleSend}>
                  <ArrowUpRight size={20} /> Send File
                </button>
                <button className="btn btn-secondary" onClick={handleReceive}>
                  <ArrowDownLeft size={20} /> Receive File
                </button>
              </div>
            </motion.div>
          )}

          {view === 'send' && (
            <motion.div 
              key="send"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="glass-card"
            >
              <div className="card-header">
                <h2>Send a File</h2>
                <button className="icon-btn" onClick={handleHome}><X /></button>
              </div>

              <div className="card-body">
                {status === 'idle' && (
                  <div 
                    className="upload-area"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current.click()}
                  >
                    <File size={40} className="upload-icon" />
                    <p>Click or Drag & Drop a file here</p>
                    <span className="upload-limit">Max 500 MB</span>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={onFileChange} 
                    />
                  </div>
                )}

                {errorMsg && <div className="error-alert">{errorMsg}</div>}

                {status === 'connecting' && (
                  <div className="status-box">
                    <div className="spinner"></div>
                    <p>Initializing secure transfer...</p>
                  </div>
                )}

                {status === 'ready' && peerId && (
                  <div className="share-details">
                    <p className="instruction">Scan the QR code or share your unique ID:</p>
                    <div className="peer-id-box">{peerId}</div>
                    
                    <div className="modern-qr-card">
                       <span className="scan-corners top-left"></span>
                       <span className="scan-corners top-right"></span>
                       <span className="scan-corners bottom-left"></span>
                       <span className="scan-corners bottom-right"></span>
                       <div className="qr-glowing-wrapper" title="Scan with camera">
                         <QRCodeSVG 
                           value={`${window.location.origin}?receive=${peerId}`} 
                           size={180} 
                           bgColor="#ffffff" 
                           fgColor="#000000" 
                           level="Q"
                         />
                       </div>
                    </div>
                    <p className="waiting-text">Waiting for receiver to connect...</p>
                    <div className="timer-container">
                      <span className="timer-label">SESSION EXPIRES IN</span>
                      <p className="cyber-timer">{formatTime(expiryTimer)}</p>
                    </div>
                  </div>
                )}

                {status === 'transferring' && (
                  <div className="transfer-progress">
                    <div className="connection-viz">
                       <div className="viz-node sender">
                         <User size={32} />
                         <span>Sender</span>
                       </div>
                       <div className="viz-line">
                         <div className="viz-pip"></div>
                         <div className="viz-pip" style={{ animationDelay: '1s' }}></div>
                         <div className="viz-pip" style={{ animationDelay: '2s' }}></div>
                       </div>
                       <div className="viz-node receiver active">
                         <User size={32} />
                         <span>Receiver</span>
                       </div>
                    </div>
                    
                    <h3>Sending: {fileMeta?.name}</h3>
                    <div className="progress-track">
                      <motion.div 
                        className="progress-fill" 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      ></motion.div>
                    </div>
                    <p className="progress-text">{progress}%</p>
                  </div>
                )}

                {status === 'complete' && (
                   <div className="success-box">
                     <h3>Transfer Complete! 🎉</h3>
                     <p>Your file was delivered successfully.</p>
                     <button className="btn btn-primary mt-4" onClick={handleHome}>Send Another</button>
                   </div>
                )}

              </div>
            </motion.div>
          )}

          {view === 'receive' && (
            <motion.div 
              key="receive"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="glass-card"
            >
               <div className="card-header">
                <h2>Receive a File</h2>
                <button className="icon-btn" onClick={handleHome}><X /></button>
              </div>

              <div className="card-body">
                {(status === 'idle' || status === 'error') && (
                  <div className="input-group">
                     <p>Enter the sender's 6-character connection ID:</p>
                     <input 
                       type="text" 
                       className="modern-input" 
                       placeholder="" 
                       value={receiverId}
                       onChange={(e) => setReceiverId(e.target.value)}
                     />
                     <button className="btn btn-primary mt-4 w-full" onClick={startReceive}>
                       Connect
                     </button>
                  </div>
                )}

                {errorMsg && <div className="error-alert mt-4">{errorMsg}</div>}

                {status === 'connecting' && (
                  <div className="status-box">
                    <div className="spinner"></div>
                    <p>Connecting to peer...</p>
                  </div>
                )}

                {status === 'ready' && (
                   <div className="status-box">
                     <div className="spinner"></div>
                     <p>Receiver is connected to Sender! <br/> Awaiting file...</p>
                   </div>
                )}

                {status === 'transferring' && (
                  <div className="transfer-progress">
                    <div className="connection-viz">
                       <div className="viz-node sender active">
                         <User size={32} />
                         <span>Sender</span>
                       </div>
                       <div className="viz-line reverse">
                         <div className="viz-pip"></div>
                         <div className="viz-pip" style={{ animationDelay: '1s' }}></div>
                         <div className="viz-pip" style={{ animationDelay: '2s' }}></div>
                       </div>
                       <div className="viz-node receiver active">
                         <User size={32} />
                         <span>Receiver</span>
                       </div>
                    </div>

                    <h3>Receiving: {fileMeta?.name}</h3>
                    <p className="size-text">{(fileMeta?.size / (1024*1024)).toFixed(2)} MB</p>
                    <div className="progress-track">
                      <motion.div 
                        className="progress-fill" 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      ></motion.div>
                    </div>
                    <p className="progress-text">{progress}%</p>
                  </div>
                )}

                {status === 'complete' && (
                   <div className="success-box">
                     <div className="success-icon-wrapper">
                        <ShieldCheck size={64} className="text-success" />
                     </div>
                     <h3>Transfer Complete! 🎉</h3>
                     <p className="mt-2" style={{ color: '#94a3b8' }}>The file has been saved to your downloads.</p>
                     
                     <div className="complete-actions">
                        <a href={downloadUrl} download={fileMeta?.name} className="btn btn-secondary mt-4 w-full">
                          Download Again
                        </a>
                        <button className="btn btn-primary mt-2 w-full" onClick={handleHome}>Done</button>
                     </div>
                   </div>
                )}

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
      
      <AnimatePresence>
         {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
