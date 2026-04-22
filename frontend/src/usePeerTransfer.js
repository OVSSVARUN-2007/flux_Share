import { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 256 * 1024; // 256 KB

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
    const peer = new Peer(randomId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setStatus('ready');
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setConnection(conn);
      setupSenderConnection(conn);
      // PERMANENTLY DESTROY OTP SO NO ONE ELSE CAN CONNECT
      peer.disconnect();
    });

    peer.on('error', (err) => {
      setErrorMsg(err.message || 'Peer connection error');
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
    let offset = 0;
    const reader = new FileReader();
    const file = fileRef.current;
    if(!file) return;
    const totalSize = file.size;

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      conn.send({
        type: 'file-chunk',
        chunk: e.target.result,
        offset: offset
      });
      
      offset += e.target.result.byteLength;
      
      const p = Math.round((offset / totalSize) * 100);
      setProgress(p);

      if (offset < totalSize) {
        if (conn.dataChannel && conn.dataChannel.bufferedAmount > 8 * 1024 * 1024) {
          setTimeout(readNextChunk, 100);
        } else if (conn.dataChannel && conn.dataChannel.bufferedAmount > 4 * 1024 * 1024) {
          setTimeout(readNextChunk, 50);
        } else {
          readNextChunk();
        }
      } else {
        conn.send({ type: 'file-end' });
        setStatus('complete');
        setTimeout(() => {
          conn.close();
        }, 2000);
      }
    };

    readNextChunk();
  };

  const initReceiver = (targetId) => {
    if (!targetId) {
      setErrorMsg('Please enter a valid ID');
      return;
    }

    setStatus('connecting');
    setErrorMsg('');
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(targetId, { reliable: true });
      connRef.current = conn;
      setConnection(conn);
      
      conn.on('error', (err) => {
        setErrorMsg(err.message);
        setStatus('error');
      });

      setupReceiverConnection(conn);
    });

    peer.on('error', (err) => {
       setErrorMsg(err.message || 'Failed to connect');
       setStatus('error');
    });
  };

  const setupReceiverConnection = (conn) => {
    conn.on('open', () => {
      setStatus('ready'); // Connected, waiting
    });

    conn.on('data', (data) => {
      if (data.type === 'metadata') {
        expectedSizeRef.current = data.size;
        setFileMeta({ name: data.name, size: data.size, type: data.mime });
        setStatus('transferring');
        conn.send({ type: 'ready' });
      } else if (data.type === 'file-chunk') {
        fileChunksRef.current.push(data.chunk);
        receivedSizeRef.current += data.chunk.byteLength;
        
        const p = Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100);
        setProgress(p);
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
