import { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 64 * 1024; // 64 KB (optimal for WebRTC)

export function usePeerTransfer() {
  const [peerId, setPeerId] = useState(null);
  const [connection, setConnection] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, connecting, ready, transferring, complete, error
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0); // in MB/s
  const [errorMsg, setErrorMsg] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(0);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const fileRef = useRef(null);

  // File receiving states
  const fileChunksRef = useRef([]);
  const expectedSizeRef = useRef(0);
  const receivedSizeRef = useRef(0);

  // Initialize Peer instance ONCE on mount
  useEffect(() => {
    if (!peerRef.current) {
      console.log('Hook: Initializing Peer instance...');
      // Fix: First argument must be undefined to use auto-generated ID with PEER_CONFIG as second arg
      const peer = new Peer(undefined, PEER_CONFIG);
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('Hook: Peer server connected. ID:', id);
        setPeerId(id);
      });

      peer.on('error', (err) => {
        console.error('Hook: Peer Error:', err);
        if (err.type === 'peer-unavailable') {
          setErrorMsg('Sender not found. Check if the code is correct.');
        } else {
          setErrorMsg('Connection error: ' + err.type);
        }
        setStatus('error');
      });

      peer.on('connection', (conn) => {
        console.log('Hook: Incoming connection from', conn.peer);
        connRef.current = conn;
        setConnection(conn);
        setupSenderConnection(conn);
      });
    }
  }, []);

  // Speed calculation logic
  useEffect(() => {
    let interval;
    if (status === 'transferring') {
      lastTimeRef.current = Date.now();
      lastBytesRef.current = 0;

      interval = setInterval(() => {
        const now = Date.now();
        const duration = (now - lastTimeRef.current) / 1000; // seconds
        const currentBytes = status === 'transferring' ? (offsetRef.current || receivedSizeRef.current) : 0;
        const bytesDiff = currentBytes - lastBytesRef.current;

        if (duration > 0) {
          const mbps = (bytesDiff / (1024 * 1024)) / duration;
          setSpeed(mbps.toFixed(2));
        }

        lastTimeRef.current = now;
        lastBytesRef.current = currentBytes;
      }, 1000);
    } else {
      setSpeed(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const offsetRef = useRef(0);

  const PEER_CONFIG = {
    debug: 3,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'stun:stun.nextcloud.com:443' },
        { urls: 'stun:stun.ekiga.net' },
        { urls: 'stun:stun.ideasip.com' },
        { urls: 'stun:stun.schlund.de' },
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
    setStatus('ready');
    setErrorMsg('');

    if (!peerId) {
      setErrorMsg('Still connecting to server... Please wait a second.');
    }
  };

  const setupSenderConnection = (conn) => {
    console.log('Sender: Connection received from', conn.peer);

    conn.on('open', () => {
      console.log('Sender: Connection fully open with', conn.peer);
      // We don't send metadata yet. We wait for the receiver to say they are ready.
    });

    conn.on('data', (data) => {
      console.log('Sender: Received message', data.type || 'Binary');

      if (data.type === 'receiver-ready') {
        console.log('Sender: Receiver is ready, sending metadata...');
        setStatus('transferring');
        conn.send({
          type: 'metadata',
          name: fileRef.current.name,
          size: fileRef.current.size,
          mime: fileRef.current.type
        });
      } else if (data.type === 'start-transfer') {
        console.log('Sender: Start signal received. Beginning binary stream...');
        sendFileChunks(conn);
      }
    });

    conn.on('close', () => {
      console.log('Sender: Connection closed');
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
    console.log('Sender: Starting transfer of', file.name, 'Size:', totalSize);

    const sendNextChunk = () => {
      const BUFFER_THRESHOLD = 1024 * 1024;

      while (offset < totalSize && conn.dataChannel && conn.dataChannel.bufferedAmount < BUFFER_THRESHOLD) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();

        reader.onload = (e) => {
          if (!conn.open) return;

          try {
            conn.send(e.target.result);
            offset += e.target.result.byteLength;
            offsetRef.current = offset;
            const p = Math.round((offset / totalSize) * 100);
            setProgress(p);

            if (offset >= totalSize) {
              console.log('Sender: All chunks sent. Finalizing...');
              conn.send({ type: 'file-end' });
              setStatus('complete');
              setTimeout(() => conn.close(), 2000);
            } else {
              sendNextChunk();
            }
          } catch (err) {
            console.error('Sender: Send error:', err);
            setErrorMsg('Data channel error. Transfer failed.');
            setStatus('error');
          }
        };

        reader.readAsArrayBuffer(slice);
        return;
      }
    };

    if (conn.dataChannel) {
      conn.dataChannel.bufferedAmountLowThreshold = 512 * 1024;
      conn.dataChannel.onbufferedamountlow = () => sendNextChunk();
      sendNextChunk();
    } else {
      setTimeout(() => sendFileChunks(conn), 100);
    }
  };

  const initReceiver = (targetId) => {
    if (!targetId || !peerRef.current) {
      setErrorMsg('Internal error or invalid ID');
      return;
    }

    const finalId = targetId.trim();
    console.log('Receiver: Attempting connection to', finalId);

    setStatus('connecting');
    setErrorMsg('');

    const attemptConnect = (retries = 15) => {
      const conn = peerRef.current.connect(finalId, { reliable: true });
      connRef.current = conn;
      setConnection(conn);

      const timeout = setTimeout(() => {
        if (conn.open) return;
        if (retries > 0) {
          console.warn('Receiver: Retry...', retries);
          conn.close();
          attemptConnect(retries - 1);
        } else {
          setErrorMsg('Sender not found. Check if the code is correct.');
          setStatus('error');
        }
      }, 2000);

      conn.on('open', () => {
        clearTimeout(timeout);
        setupReceiverConnection(conn);
      });

      conn.on('error', (err) => {
        console.warn('Receiver: Conn attempt failed', err);
      });
    };

    attemptConnect();
  };

  const setupReceiverConnection = (conn) => {
    conn.on('open', () => {
      console.log('Receiver: Connected to sender. Notifying readiness...');
      setStatus('ready');
      // Step 1: Tell sender we are ready to receive metadata
      conn.send({ type: 'receiver-ready' });
    });

    conn.on('data', (data) => {
      if (data instanceof ArrayBuffer) {
        fileChunksRef.current.push(data);
        receivedSizeRef.current += data.byteLength;
        const p = Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100);
        setProgress(p);
        return;
      }

      console.log('Receiver: Incoming message', data.type);

      if (data.type === 'metadata') {
        console.log('Receiver: Metadata received', data);
        expectedSizeRef.current = data.size;
        setFileMeta({ name: data.name, size: data.size, type: data.mime });
        setStatus('transferring');
        // Step 2: Confirm metadata and tell sender to start the binary stream
        conn.send({ type: 'start-transfer' });
      } else if (data.type === 'file-end') {
        console.log('Receiver: File-end signal received. Reconstructing blob...');
        setProgress(100);
        setStatus('complete');
        const blob = new Blob(fileChunksRef.current, { type: fileMeta?.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        fileChunksRef.current = [];
      }
    });

    conn.on('close', () => {
      console.log('Receiver: Connection closed');
      if (status !== 'complete') {
        // handle error
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
    speed,
    errorMsg,
    fileMeta,
    downloadUrl,
    initSender,
    initReceiver,
    reset
  };
}
