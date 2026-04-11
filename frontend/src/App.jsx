import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, ArrowDownLeft, X, File, ShieldCheck, Zap } from 'lucide-react';
import { usePeerTransfer } from './usePeerTransfer';
import './index.css';

export default function App() {
  const [view, setView] = useState('home'); // home, send, receive
  const {
    peerId, status, progress, errorMsg, fileMeta, downloadUrl,
    initSender, initReceiver, reset
  } = usePeerTransfer();
  
  const fileInputRef = useRef(null);
  const [receiverId, setReceiverId] = useState('');
  const [expiryTimer, setExpiryTimer] = useState(7 * 60);

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
            alert('Sharing session expired after 7 minutes.');
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
      
      <header className="header">
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h2 className="logo-text">Flux <span className="highlight">Share</span></h2>
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
                <button className="btn btn-primary" onClick={() => setView('send')}>
                  <ArrowUpRight size={20} /> Send File
                </button>
                <button className="btn btn-secondary" onClick={() => setView('receive')}>
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
                    <div className="qr-container">
                       <QRCodeSVG value={peerId} size={160} bgColor="transparent" fgColor="#fff" />
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
                       placeholder="e.g. flux-xyz123" 
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
                     <p>Connected! Awaiting file metadata...</p>
                   </div>
                )}

                {status === 'transferring' && (
                  <div className="transfer-progress">
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
                     <h3>File Received! 🎉</h3>
                     <a href={downloadUrl} download={fileMeta?.name} className="btn btn-success mt-4 w-full">
                       Save File
                     </a>
                     <button className="btn btn-secondary mt-2 w-full" onClick={handleHome}>Receive Another</button>
                   </div>
                )}

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
