import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { sendAiChatMessage } from '../../services/api/chatBotApi';
import './ChatWidget.css';

const CHAT_HISTORY_KEY = 'smartcity_chat_history';
const CHAT_POSITION_KEY = 'smartcity_chat_position';
const WIDGET_WIDTH = 380;
const WIDGET_HEIGHT = 600;

const createDefaultGreeting = () => ({
  id: 1,
  text: 'Hello! 👋 How can I help you with Smart City Discovery?',
  sender: 'bot',
  timestamp: new Date(),
});

const getDefaultPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 20, y: 100 };
  }

  return {
    x: Math.max(8, window.innerWidth - WIDGET_WIDTH - 20),
    y: Math.max(8, window.innerHeight - WIDGET_HEIGHT - 100),
  };
};

const clampPosition = (position, width = WIDGET_WIDTH, height = WIDGET_HEIGHT) => {
  if (typeof window === 'undefined') {
    return position;
  }

  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);

  return {
    x: Math.min(Math.max(8, Number(position?.x) || 8), maxX),
    y: Math.min(Math.max(8, Number(position?.y) || 8), maxY),
  };
};

const toValidDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
};

const normalizeMessage = (message, fallbackId) => ({
  id: Number(message?.id) || fallbackId,
  text: typeof message?.text === 'string' ? message.text : '',
  sender: message?.sender === 'user' ? 'user' : 'bot',
  timestamp: toValidDate(message?.timestamp),
});

const loadSavedMessages = (storageKey) => {
  if (!storageKey) {
    return [createDefaultGreeting()];
  }

  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return [createDefaultGreeting()];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createDefaultGreeting()];
    }

    return parsed.map((message, index) => normalizeMessage(message, index + 1));
  } catch {
    return [createDefaultGreeting()];
  }
};

const loadSavedPosition = (storageKey) => {
  if (!storageKey) {
    return getDefaultPosition();
  }

  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return getDefaultPosition();
  }

  try {
    const parsed = JSON.parse(raw);
    return clampPosition(parsed);
  } catch {
    return getDefaultPosition();
  }
};

const getCurrentLocation = () =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          resolve({ latitude, longitude });
          return;
        }

        resolve(null);
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000
      }
    );
  });

const ChatWidget = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([createDefaultGreeting()]);
  const [venueResults, setVenueResults] = useState([]);
  const [aiSuggestedNames, setAiSuggestedNames] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [isDragging, setIsDragging] = useState(false);

  const userId = useMemo(
    () => user?.id || user?.userId || user?.user_id || user?.username || user?.email || '',
    [user?.email, user?.id, user?.userId, user?.user_id, user?.username]
  );

  const messageStorageKey = useMemo(() => {
    if (!isAuthenticated || !userId) {
      return '';
    }

    return `${CHAT_HISTORY_KEY}:${String(userId)}`;
  }, [isAuthenticated, userId]);

  const positionStorageKey = useMemo(() => {
    if (!isAuthenticated || !userId) {
      return '';
    }

    return `${CHAT_POSITION_KEY}:${String(userId)}`;
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!messageStorageKey) {
      setIsOpen(false);
      setMessages([createDefaultGreeting()]);
      setVenueResults([]);
      setInputValue('');
      return;
    }

    setMessages(loadSavedMessages(messageStorageKey));
    setVenueResults([]);
    setInputValue('');
  }, [messageStorageKey]);

  useEffect(() => {
    setPosition(loadSavedPosition(positionStorageKey));
  }, [positionStorageKey]);

  useEffect(() => {
    if (!messageStorageKey) {
      return;
    }

    localStorage.setItem(messageStorageKey, JSON.stringify(messages));
  }, [messages, messageStorageKey]);

  useEffect(() => {
    if (!positionStorageKey) {
      return;
    }

    localStorage.setItem(positionStorageKey, JSON.stringify(position));
  }, [position, positionStorageKey]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatContainerRef.current && !chatContainerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      const rect = chatContainerRef.current?.getBoundingClientRect();
      const width = rect?.width || WIDGET_WIDTH;
      const height = rect?.height || WIDGET_HEIGHT;
      setPosition((prev) => clampPosition(prev, width, height));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleHeaderMouseDown = (event) => {
    if (event.button !== 0 || window.innerWidth <= 640) {
      return;
    }

    if (event.target.closest('.chat-header-actions')) {
      return;
    }

    isDraggingRef.current = true;
    setIsDragging(true);

    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      const rect = chatContainerRef.current?.getBoundingClientRect();
      const width = rect?.width || WIDGET_WIDTH;
      const height = rect?.height || WIDGET_HEIGHT;

      setPosition(
        clampPosition(
          {
            x: moveEvent.clientX - dragOffsetRef.current.x,
            y: moveEvent.clientY - dragOffsetRef.current.y,
          },
          width,
          height
        )
      );
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const trimmedInput = inputValue.trim();

    if (!trimmedInput) {
      alert('Please enter a message!');
      return;
    }

    if (trimmedInput.length > 500) {
      alert('Message cannot exceed 500 characters!');
      return;
    }

    const userMessage = {
      id: messages.length + 1,
      text: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
    };

    const chatHistory = messages
      .slice(-6)
      .map((item) => ({
        role: item.sender === 'user' ? 'user' : 'assistant',
        content: item.text
      }));

    setMessages((prev) => [...prev, userMessage]);
    setVenueResults([]);
    setInputValue('');
    setIsLoading(true);

    try {
      const location = await getCurrentLocation();
      const data = await sendAiChatMessage(trimmedInput, chatHistory, '', location);

      const botMessage = {
        id: messages.length + 2,
        text: data.reply || 'Sorry, I cannot respond right now.',
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setVenueResults(Array.isArray(data.venueResults) ? data.venueResults : []);
      setAiSuggestedNames(Array.isArray(data.aiSuggestedNames) ? data.aiSuggestedNames : []);
    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage = {
        id: messages.length + 2,
        text: "Sorry, there's an error. Please try again later.",
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setVenueResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = () => {
    if (!messageStorageKey) {
      return;
    }

    setMessages([createDefaultGreeting()]);
    setVenueResults([]);
    setInputValue('');
    localStorage.removeItem(messageStorageKey);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div
        ref={chatContainerRef}
        className={`chat-widget ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <div className="chat-header" onMouseDown={handleHeaderMouseDown}>
          <div className="chat-header-content">
            <div className="chat-header-icon">🤖</div>
            <div>
              <h3>Smart City Chat</h3>
              <p className="online-status">● Online</p>
            </div>
          </div>

          <div className="chat-header-actions">
            <button
              className="chat-clear-btn"
              onClick={clearChatHistory}
              aria-label="Clear chat history"
              title="Xóa lịch sử"
            >
              🗑️
            </button>

            <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
              ×
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`message message-${message.sender} fade-in`}>
              <div className="message-bubble">
                <p>{message.text}</p>
                <span className="message-time">
                  {toValidDate(message.timestamp).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message message-bot">
              <div className="message-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {venueResults.length > 0 && (
            <div className="chat-venue-results fade-in">
                <div className="chat-venue-results-title">Suggested venues</div>

              {venueResults.map((venue) => {
                const isSuggested = aiSuggestedNames && aiSuggestedNames.length
                  ? aiSuggestedNames.some((n) => n && n.toLowerCase().trim() === (venue.name || '').toLowerCase().trim())
                  : false;

                return (
                  <button
                    key={venue.id}
                    className={`chat-venue-card ${isSuggested ? 'is-suggested' : ''}`}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate(`/venues/${venue.id}`);
                    }}
                  >
                    <div className="chat-venue-card-header">
                      <strong>{venue.name}</strong>
                      <span>{venue.categoryName}</span>
                    </div>
                    <div className="chat-venue-card-body">
                      <p>{venue.address}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
          />

          <button
            type="submit"
            className="chat-send-btn"
            disabled={isLoading || !inputValue.trim() || inputValue.length > 500}
            aria-label="Send message"
            title={inputValue.length > 500 ? 'Message too long (max 500 characters)' : 'Send message'}
          >
            ✉️
          </button>
        </form>
      </div>

      {!isOpen && (
        <button className="chat-fab pulse" onClick={() => setIsOpen(true)} aria-label="Open chat">
          <span className="chat-fab-icon">🤖</span>
        </button>
      )}
    </>
  );
};

export default ChatWidget;
