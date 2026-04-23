import { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';

// ================= CONFIG =================
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const CHUNK_SIZE = 64 * 1024;

const PROTOCOL_VERSION = '1.0';

const STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  READY: 'ready',
  TRANSFERRING: 'transferring',
  COMPLETE: 'complete',
  ERROR: 'error',
};

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: 'YOUR_USERNAME',
        credential: 'YOUR_PASSWORD',
      },
    ],
  },
};

export function usePeerTransfer() {
  const [peerId, setPeerId] = useState(null);
  const [state, setState] = useState(STATES.IDLE);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const fileRef = useRef(null);

  const offsetRef = useRef(0);
  const receivedRef = useRef(0);
  const expectedRef = useRef(0);
  const chunksRef = useRef([]);

  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(0);

  // ================= INIT =================
  useEffect(() => {
    const peer = new Peer(undefined, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', setPeerId);

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setupSender(conn);
    });

    peer.on('error', (err) => {
      setError(err.type);
      setState(STATES.ERROR);
    });

    return () => peer.destroy();
  }, []);

  // ================= SPEED =================
  useEffect(() => {
    if (state !== STATES.TRANSFERRING) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const duration = (now - lastTimeRef.current) / 1000;

      const current = offsetRef.current || receivedRef.current;
      const diff = current - lastBytesRef.current;

      setSpeed(((diff / (1024 * 1024)) / duration).toFixed(2));

      lastBytesRef.current = current;
      lastTimeRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  // ================= SENDER =================
  const initSender = (file) => {
    if (!file || file.size > MAX_FILE_SIZE) {
      setError('Invalid file');
      return;
    }

    fileRef.current = file;
    setFileMeta(file);
    setState(STATES.READY);
  };

  const setupSender = (conn) => {
    conn.on('data', async (msg) => {
      if (msg.type === 'READY') {
        conn.send({
          type: 'META',
          version: PROTOCOL_VERSION,
          name: fileRef.current.name,
          size: fileRef.current.size,
        });
      }

      if (msg.type === 'START') {
        streamFile(conn);
      }
    });

    conn.on('close', () => {
      if (state !== STATES.COMPLETE) {
        setError('Disconnected');
        setState(STATES.ERROR);
      }
    });
  };

  const streamFile = (conn) => {
    const file = fileRef.current;
    let offset = 0;

    const sendChunk = () => {
      if (!conn.open) return;

      if (conn.dataChannel.bufferedAmount > 1_000_000) {
        setTimeout(sendChunk, 50);
        return;
      }

      if (offset >= file.size) {
        conn.send({ type: 'END' });
        setState(STATES.COMPLETE);
        return;
      }

      const reader = new FileReader();
      const slice = file.slice(offset, offset + CHUNK_SIZE);

      reader.onload = (e) => {
        conn.send(e.target.result);

        offset += e.target.result.byteLength;
        offsetRef.current = offset;

        setProgress((offset / file.size) * 100);
        sendChunk();
      };

      reader.readAsArrayBuffer(slice);
    };

    setState(STATES.TRANSFERRING);
    sendChunk();
  };

  // ================= RECEIVER =================
  const initReceiver = (id) => {
    setState(STATES.CONNECTING);

    const connect = (retry = 10) => {
      const conn = peerRef.current.connect(id);
      connRef.current = conn;

      const timeout = setTimeout(() => {
        if (!conn.open && retry > 0) {
          conn.close();
          connect(retry - 1);
        } else if (!conn.open) {
          setError('Failed to connect');
          setState(STATES.ERROR);
        }
      }, 5000);

      conn.on('open', () => {
        clearTimeout(timeout);
        setupReceiver(conn);
      });
    };

    connect();
  };

  const setupReceiver = (conn) => {
    conn.send({ type: 'READY' });

    conn.on('data', (msg) => {
      if (msg instanceof ArrayBuffer) {
        chunksRef.current.push(msg);
        receivedRef.current += msg.byteLength;

        setProgress(
          (receivedRef.current / expectedRef.current) * 100
        );
        return;
      }

      if (msg.type === 'META') {
        expectedRef.current = msg.size;
        setFileMeta(msg);
        setState(STATES.TRANSFERRING);
        conn.send({ type: 'START' });
      }

      if (msg.type === 'END') {
        const blob = new Blob(chunksRef.current);
        setDownloadUrl(URL.createObjectURL(blob));
        setState(STATES.COMPLETE);
      }
    });
  };

  // ================= RESET =================
  const reset = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();

    setState(STATES.IDLE);
    setProgress(0);
    setError('');
    setDownloadUrl(null);

    chunksRef.current = [];
    receivedRef.current = 0;
    expectedRef.current = 0;
  }, []);

  return {
    peerId,
    state,
    progress,
    speed,
    error,
    fileMeta,
    downloadUrl,
    initSender,
    initReceiver,
    reset,
  };
}