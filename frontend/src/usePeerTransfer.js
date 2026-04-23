import { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 64 * 1024; // 64 KB (optimal for WebRTC)

export function usePeerTransfer() {
  const [peerId, setPeerId] = useState(null);
  const [connection, setConnection] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, connecting, ready, transferring, complete, error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const fileRef = useRef(null);
  
  // File receiving states
  const fileChunksRef = useRef([]);
  const expectedSizeRef = useRef(0);
  const receivedSizeRef = useRef(0);

  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      sdpSemantics: 'unified-plan'
    }
  };

  const initSender = (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg('File size exceeds 500MB limit.');
      return;
    }
    
    fileRef.current = file;
    setFileMeta({ name: file.name, size: file.size, type: file.type });
    setStatus('connecting');
    setErrorMsg('');

    const randomId = 'flux-' + Math.random().toString(36).substr(2, 6);
    const peer = new Peer(randomId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setStatus('ready');
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setConnection(conn);
      setupSenderConnection(conn);
      // NOTE: We don't disconnect immediately anymore. 
      // We'll let the peer stay connected to the server until the transfer starts.
    });

    peer.on('error', (err) => {
      console.error('Peer Error:', err);
      setErrorMsg(err.type === 'peer-unavailable' ? 'Sender ID not found. Verify the ID is correct.' : (err.message || 'Connection error'));
      setStatus('error');
    });
  };

  const setupSenderConnection = (conn) => {
    conn.on('open', () => {
      setStatus('transferring');
      conn.send({
        type: 'metadata',
        name: fileRef.current.name,
        size: fileRef.current.size,
        mime: fileRef.current.type
      });
    });

    conn.on('data', (data) => {
      if (data.type === 'ready') {
        sendFileChunks(conn);
      }
    });

    conn.on('close', () => {
      if (status !== 'complete') {
         setErrorMsg('Connection closed unexpectedly.');
      }
    });
  };

  const sendFileChunks = (conn) => {
    const file = fileRef.current;
    if (!file) return;

    let offset = 0;
    const totalSize = file.size;

    const sendNextChunk = () => {
      // Use PeerJS's bufferedAmount via the internal dataChannel
      // 1MB threshold is safe for most browsers
      const BUFFER_THRESHOLD = 1024 * 1024; 

      while (offset < totalSize && conn.dataChannel && conn.dataChannel.bufferedAmount < BUFFER_THRESHOLD) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();

        reader.onload = (e) => {
          if (!conn.open) return;

          try {
            // Use conn.send instead of dataChannel.send to maintain PeerJS protocol consistency
            conn.send(e.target.result);
            
            offset += e.target.result.byteLength;
            const p = Math.round((offset / totalSize) * 100);
            setProgress(p);

            if (offset >= totalSize) {
              conn.send({ type: 'file-end' });
              setStatus('complete');
              setTimeout(() => conn.close(), 2000);
            } else {
              // Pulse the loop
              sendNextChunk();
            }
          } catch (err) {
            console.error('Send error:', err);
            setErrorMsg('Data channel error. Transfer failed.');
            setStatus('error');
          }
        };

        reader.readAsArrayBuffer(slice);
        return; // Wait for reader to finish
      }
    };

    if (conn.dataChannel) {
      conn.dataChannel.bufferedAmountLowThreshold = 512 * 1024;
      conn.dataChannel.onbufferedamountlow = () => sendNextChunk();
      sendNextChunk();
    } else {
       // If channel not yet mapped, wait a bit
       setTimeout(() => sendFileChunks(conn), 100);
    }
  };

  const initReceiver = (targetId) => {
    if (!targetId) {
      setErrorMsg('Please enter a valid ID');
      return;
    }

    // Automatically prepend 'flux-' if user only enters the 6-character PIN
    const finalId = targetId.startsWith('flux-') ? targetId : `flux-${targetId}`;

    setStatus('connecting');
    setErrorMsg('');
    const peer = new Peer(PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(finalId); // Use normalized ID
      connRef.current = conn;
      setConnection(conn);
      
      conn.on('error', (err) => {
        console.error('Connection Error:', err);
        setErrorMsg('Connection lost or failed: ' + err.message);
        setStatus('error');
      });

      setupReceiverConnection(conn);
    });

    peer.on('error', (err) => {
       console.error('Peer Error:', err);
       let msg = 'Failed to connect';
       if (err.type === 'peer-unavailable') msg = 'The sender ID does not exist. Check for typos.';
       else if (err.type === 'network') msg = 'Network error. Please check your connection.';
       
       setErrorMsg(msg);
       setStatus('error');
    });
  };

  const setupReceiverConnection = (conn) => {
    conn.on('open', () => {
      setStatus('ready'); // Connected, waiting
    });

    conn.on('data', (data) => {
      if (data instanceof ArrayBuffer) {
        // High-speed binary chunk received
        fileChunksRef.current.push(data);
        receivedSizeRef.current += data.byteLength;
        const p = Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100);
        setProgress(p);
        return;
      }

      if (data.type === 'metadata') {
        expectedSizeRef.current = data.size;
        setFileMeta({ name: data.name, size: data.size, type: data.mime });
        setStatus('transferring');
        conn.send({ type: 'ready' });
      } else if (data.type === 'file-end') {
        setProgress(100);
        setStatus('complete');
        // create blob
        const blob = new Blob(fileChunksRef.current, { type: fileMeta?.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        // clean up
        fileChunksRef.current = [];
      }
    });

    conn.on('close', () => {
       if(status !== 'complete') {
           // connection lost
       }
    });
  };

  const reset = useCallback(() => {
    if (connRef.current) connRef.current.close();
    if (peerRef.current) peerRef.current.destroy();
    setStatus('idle');
    setProgress(0);
    setPeerId(null);
    setConnection(null);
    setErrorMsg('');
    setFileMeta(null);
    setDownloadUrl(null);
    fileRef.current = null;
    fileChunksRef.current = [];
    expectedSizeRef.current = 0;
    receivedSizeRef.current = 0;
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  return {
    peerId,
    status,
    progress,
    errorMsg,
    fileMeta,
    downloadUrl,
    initSender,
    initReceiver,
    reset
  };
}
